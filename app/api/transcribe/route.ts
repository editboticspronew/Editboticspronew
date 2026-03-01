import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/transcribe
 *
 * Transcribes speech from a video using Google Cloud Video Intelligence API
 * (SPEECH_TRANSCRIPTION feature). Works directly on video files stored in
 * Google Cloud Storage — no audio extraction needed.
 *
 * Accepts JSON: { storagePath, language }
 */

// ─── Auth ──────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountJson = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    throw new Error(
      'GOOGLE_CLOUD_SERVICE_ACCOUNT not configured. Set this environment variable with your service account JSON.'
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('Invalid JSON in GOOGLE_CLOUD_SERVICE_ACCOUNT');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleAuth } = require('google-auth-library');

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error('Failed to obtain Google Cloud access token');
  }

  return accessToken.token;
}

// ─── Helpers ───────────────────────────────────────────────

function parseTimeOffset(timeOffset?: string): number {
  if (!timeOffset) return 0;
  return parseFloat(timeOffset.replace('s', ''));
}

/**
 * Language code mapping — Google Speech uses BCP-47 codes.
 */
function toSpeechLanguageCode(lang: string): string {
  const mapping: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-BR',
    nl: 'nl-NL',
    ru: 'ru-RU',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    ar: 'ar-SA',
    hi: 'hi-IN',
    tr: 'tr-TR',
    pl: 'pl-PL',
    uk: 'uk-UA',
    vi: 'vi-VN',
    th: 'th-TH',
    sv: 'sv-SE',
    da: 'da-DK',
    no: 'nb-NO',
    fi: 'fi-FI',
  };
  return mapping[lang] || `${lang}-${lang.toUpperCase()}`;
}

/**
 * Process raw speech transcription results into timestamped segments.
 */
function processTranscriptionResult(annotationResults: any): {
  text: string;
  segments: Array<{ text: string; start: number; end: number }>;
  language: string;
  duration: number;
} {
  const speechTranscriptions = annotationResults.speechTranscriptions || [];

  const segments: Array<{ text: string; start: number; end: number }> = [];
  let fullText = '';
  let maxEnd = 0;
  let detectedLanguage = '';

  for (const transcription of speechTranscriptions) {
    // Take the first alternative (highest confidence)
    const alternative = transcription.alternatives?.[0];
    if (!alternative || !alternative.transcript) continue;

    const transcript = alternative.transcript.trim();
    if (!transcript) continue;

    if (alternative.languageCode) {
      detectedLanguage = alternative.languageCode;
    }

    // Build segment from word-level timestamps
    const words = alternative.words || [];

    if (words.length > 0) {
      const start = parseTimeOffset(words[0].startTime);
      const end = parseTimeOffset(words[words.length - 1].endTime);

      segments.push({ text: transcript, start, end });
      maxEnd = Math.max(maxEnd, end);
    } else {
      // No word-level timestamps — approximate
      segments.push({ text: transcript, start: maxEnd, end: maxEnd + 5 });
      maxEnd += 5;
    }

    fullText += (fullText ? ' ' : '') + transcript;
  }

  return { text: fullText, segments, language: detectedLanguage, duration: maxEnd };
}

// ─── POST handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { storagePath, language = 'en' } = await request.json();

    if (!storagePath) {
      return NextResponse.json(
        { error: 'storagePath is required' },
        { status: 400 }
      );
    }

    // Construct GCS URI from Firebase Storage path
    let inputUri: string;
    if (storagePath.startsWith('gs://')) {
      inputUri = storagePath;
    } else {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (bucket) {
        inputUri = `gs://${bucket}/${storagePath}`;
      } else {
        return NextResponse.json(
          { error: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not configured' },
          { status: 500 }
        );
      }
    }

    console.log('🎤 Google Cloud Speech Transcription');
    console.log('📍 Input URI:', inputUri);
    console.log('🌐 Language:', language);

    const accessToken = await getGoogleAccessToken();
    const speechLanguageCode = toSpeechLanguageCode(language);

    // Use Video Intelligence SPEECH_TRANSCRIPTION feature
    // Note: word-level timestamps are returned automatically by
    // Video Intelligence — no enableWordTimeOffsets flag needed.
    const requestBody = {
      inputUri,
      features: ['SPEECH_TRANSCRIPTION'],
      videoContext: {
        speechTranscriptionConfig: {
          languageCode: speechLanguageCode,
          enableAutomaticPunctuation: true,
          maxAlternatives: 1,
        },
      },
    };

    const response = await fetch(
      'https://videointelligence.googleapis.com/v1/videos:annotate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Google Speech API error:', error);
      return NextResponse.json(
        {
          error: `Google Cloud transcription error: ${
            error.error?.message || response.statusText
          }`,
        },
        { status: response.status }
      );
    }

    const operation = await response.json();
    console.log('🔄 Transcription started:', operation.name);

    // Poll for completion (max ~10 minutes)
    let attempts = 0;
    const maxAttempts = 120;

    while (attempts < maxAttempts) {
      const pollResponse = await fetch(
        `https://videointelligence.googleapis.com/v1/${operation.name}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const pollResult = await pollResponse.json();

      if (pollResult.done) {
        if (pollResult.error) {
          console.error('❌ Transcription operation failed:', pollResult.error);
          throw new Error(`Transcription failed: ${pollResult.error.message}`);
        }

        console.log('✅ Transcription complete');
        const annotationResults = pollResult.response.annotationResults[0];
        const result = processTranscriptionResult(annotationResults);

        console.log('📊 Transcription summary:');
        console.log('  - Segments:', result.segments.length);
        console.log('  - Duration:', result.duration.toFixed(1), 'seconds');
        console.log('  - Language:', result.language);

        return NextResponse.json(result);
      }

      console.log(`⏳ Transcription polling... attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    return NextResponse.json(
      { error: 'Transcription timed out (10 minutes). Try a shorter video.' },
      { status: 504 }
    );
  } catch (error: any) {
    console.error('❌ Transcription error:', error);
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}

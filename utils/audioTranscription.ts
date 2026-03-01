/**
 * Audio/video transcription utilities using Google Cloud Video Intelligence API
 * (SPEECH_TRANSCRIPTION feature). Transcribes directly from video files in
 * Google Cloud Storage — no audio extraction needed.
 */

export interface TranscriptWord {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  words?: TranscriptWord[];
}

export interface TranscriptionResult {
  text: string; // Full transcript
  segments: TranscriptSegment[]; // Timestamped segments
  language?: string;
  duration?: number;
}

/**
 * Transcribe a video using Google Cloud Video Intelligence via Next.js API route.
 * Works directly on the video's GCS storage path — no audio extraction needed.
 */
export async function transcribeVideo(
  storagePath: string,
  options: {
    language?: string; // e.g., 'en', 'es', 'fr' (default: 'en')
  } = {}
): Promise<TranscriptionResult> {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storagePath,
      language: options.language || 'en',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Transcription failed: ${error.error || response.statusText}`);
  }

  const result = await response.json();

  return {
    text: result.text,
    segments: result.segments || [],
    language: result.language,
    duration: result.duration,
  };
}

/**
 * @deprecated Use transcribeVideo() instead. Kept for backward compatibility.
 * Redirects to the new Google Cloud-based transcription.
 */
export async function transcribeAudio(
  _audioFile: File | Blob,
  options: {
    language?: string;
    prompt?: string;
    temperature?: number;
    timestampGranularity?: 'segment' | 'word';
    storagePath?: string; // New: pass storage path to use Google Cloud
  } = {}
): Promise<TranscriptionResult> {
  if (!options.storagePath) {
    throw new Error(
      'Transcription now uses Google Cloud Video Intelligence and requires a storagePath. ' +
      'Audio extraction is no longer needed — pass the video storage path directly.'
    );
  }

  return transcribeVideo(options.storagePath, { language: options.language });
}

/**
 * Convert transcript segments to text overlay clips
 */
export function segmentsToTextOverlays(
  segments: TranscriptSegment[],
  options: {
    fontSize?: number;
    color?: string;
    x?: number;
    y?: number;
    maxWidth?: number;
    splitLongText?: boolean;
    maxCharsPerLine?: number;
  } = {}
): Array<{
  text: string;
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}> {
  const {
    fontSize = 24,
    color = '#ffffff',
    x = 50,
    y = 80,
    maxWidth = 80,
    splitLongText = true,
    maxCharsPerLine = 40,
  } = options;

  return segments.map((segment) => {
    let text = segment.text.trim();

    // Split long text into multiple lines if needed
    if (splitLongText && text.length > maxCharsPerLine) {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + ' ' + word).length > maxCharsPerLine) {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      if (currentLine) lines.push(currentLine);
      text = lines.join('\n');
    }

    return {
      text,
      startTime: segment.start,
      endTime: segment.end,
      x,
      y,
      fontSize,
      color,
      bold: false,
      italic: false,
    };
  });
}

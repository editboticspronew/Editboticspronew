import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileUrl = formData.get('fileUrl') as string | null;
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null;
    const temperature = formData.get('temperature') as string | null;
    const timestampGranularity = formData.get('timestampGranularity') as string | null;

    if (!file && !fileUrl) {
      return NextResponse.json(
        { error: 'Either file or fileUrl is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🔑 OpenAI API Key available:', !!apiKey);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured on server' },
        { status: 500 }
      );
    }

    // If URL is provided, fetch the file first
    let audioFile: File | Blob;
    let fileName: string;
    
    if (fileUrl) {
      console.log('📥 Fetching file from URL:', fileUrl);
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file from URL: ${fileResponse.statusText}`);
      }
      const blob = await fileResponse.blob();
      // Extract filename from URL or use default
      const urlParts = fileUrl.split('/');
      fileName = urlParts[urlParts.length - 1].split('?')[0] || 'audio.mp4';
      audioFile = new File([blob], fileName, { type: blob.type });
      console.log('✅ File fetched from URL:', fileName);
    } else {
      audioFile = file!;
      fileName = file!.name;
    }

    // Create FormData for OpenAI API
    const openaiFormData = new FormData();
    openaiFormData.append('file', audioFile);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('response_format', 'verbose_json');
    openaiFormData.append('timestamp_granularities[]', timestampGranularity || 'segment');

    if (language) {
      openaiFormData.append('language', language);
    }
    if (prompt) {
      openaiFormData.append('prompt', prompt);
    }
    if (temperature) {
      openaiFormData.append('temperature', temperature);
    }

    console.log('📤 Sending request to OpenAI...');
    console.log('📤 File name:', fileName);
    console.log('📤 File size:', audioFile.size);

    // Call OpenAI API with retry logic for 502 errors
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: openaiFormData,
          signal: AbortSignal.timeout(60000), // 60 second timeout
        });

        console.log(`📥 OpenAI Response status (attempt ${attempts}):`, response.status);
        
        // If successful or client error (not server error), break
        if (response.ok || response.status < 500) {
          break;
        }
        
        // If 502/503/504, retry
        if (attempts < maxAttempts) {
          console.log(`⏳ Retrying in 2 seconds... (attempt ${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err: any) {
        console.error(`❌ Fetch error (attempt ${attempts}):`, err.message);
        if (attempts >= maxAttempts) {
          throw new Error(`Network error after ${maxAttempts} attempts: ${err.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!response) {
      throw new Error('Failed to get response from OpenAI after retries');
    }

    console.log('📥 OpenAI Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI Error Response:', errorText);
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText };
      }
      
      return NextResponse.json(
        { error: error.error?.message || error.error || errorText || 'Transcription failed' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      text: result.text,
      segments: result.segments || [],
      language: result.language,
      duration: result.duration,
    });

  } catch (error: any) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

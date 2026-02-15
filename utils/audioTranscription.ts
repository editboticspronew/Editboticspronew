/**
 * Audio transcription utilities using OpenAI Whisper API
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
 * Transcribe audio using OpenAI Whisper API via Next.js API route
 */
export async function transcribeAudio(
  audioFile: File | Blob | string, // Now accepts URL as string
  apiKey: string, // Kept for backward compatibility but not used (server uses env var)
  options: {
    language?: string; // e.g., 'en', 'es', 'fr' (auto-detect if not provided)
    prompt?: string; // Optional context to improve accuracy
    temperature?: number; // 0-1, lower = more focused
    timestampGranularity?: 'segment' | 'word'; // Default: segment
  } = {}
): Promise<TranscriptionResult> {
  const formData = new FormData();
  
  // If string is passed, treat it as a URL
  if (typeof audioFile === 'string') {
    formData.append('fileUrl', audioFile);
  } else {
    formData.append('file', audioFile);
  }
  
  formData.append('timestampGranularity', options.timestampGranularity || 'segment');

  if (options.language) {
    formData.append('language', options.language);
  }
  if (options.prompt) {
    formData.append('prompt', options.prompt);
  }
  if (options.temperature !== undefined) {
    formData.append('temperature', String(options.temperature));
  }

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
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
 * Validate OpenAI API key
 */
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
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

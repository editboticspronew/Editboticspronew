# AI Video Analysis Providers Comparison

## 🔍 Google Cloud Video Intelligence API

**Cost:** ~$1.25 per video (6 features)

### ✅ What it Provides (VISUAL Analysis)
- **Shot/Scene Detection** - Automatically detects scene changes
- **Label Detection** - Identifies objects, actions, locations (e.g., "person", "car", "beach")
- **Text Detection (OCR)** - Reads on-screen text with timestamps
- **Object Tracking** - Tracks specific objects across frames
- **Face Detection** - Counts faces and tracks them over time
- **Explicit Content Detection** - Flags inappropriate content
- **Speech Transcription** - Built-in audio transcription

### 🎯 What You Get
```json
{
  "scenes": [
    { "start": 0, "end": 5.2, "description": "Scene 1" },
    { "start": 5.2, "end": 12.8, "description": "Scene 2" }
  ],
  "labels": [
    { 
      "label": "Person", 
      "confidence": 0.95,
      "timeRanges": [{ "start": 0, "end": 30 }]
    },
    { "label": "Computer", "confidence": 0.87, "timeRanges": [...] }
  ],
  "detectedText": [
    {
      "text": "Subscribe Now!",
      "timeRanges": [{ "start": 5.0, "end": 8.0 }]
    }
  ],
  "objects": [
    { "object": "Laptop", "appearances": 15 },
    { "object": "Coffee mug", "appearances": 8 }
  ],
  "faces": 2,
  "explicitContent": false
}
```

### 💪 Strengths
- **Can SEE the video** - Analyzes actual visual content
- **No transcript needed** - Works even without audio
- **Comprehensive** - Detects objects, text, faces, scenes
- **Accurate** - Uses Google's computer vision models

### ⚠️ Limitations
- **Expensive** - $1.25 per video
- **Requires Google Cloud setup** - Service account, credentials
- **Server-side only** - Can't run in browser (needs OAuth)
- **Generic descriptions** - "Scene 1", "Scene 2" (not content-aware)
- **No editing suggestions** - Just raw detection data

---

## 💬 OpenAI GPT-4o-mini (Text-Based)

**Cost:** ~$0.40 per video

### ✅ What it Provides (TRANSCRIPT Analysis)
- **Content Summary** - Overview, main topic, speakers
- **Scene Suggestions** - Based on what's discussed
- **Editing Recommendations** - Cut suggestions, pacing notes
- **Text Overlay Ideas** - Where to add captions/graphics
- **Key Moments** - Highlights from the conversation
- **Smart Insights** - Content-aware suggestions

### 🎯 What You Get
```json
{
  "summary": {
    "overview": "Tutorial on React hooks explaining useState and useEffect",
    "mainTopic": "React useState and useEffect hooks",
    "speakers": "1 speaker (instructor)",
    "keyPoints": [
      "useState manages component state",
      "useEffect handles side effects",
      "Dependencies array controls re-runs"
    ]
  },
  "scenes": [
    {
      "timestamp": "00:00",
      "description": "Introduction and hook overview",
      "recommendation": "Keep intro concise, consider adding title card"
    }
  ],
  "suggestions": {
    "cuts": [{ "time": "02:15", "reason": "Long pause, remove silence" }],
    "textOverlays": [
      { 
        "time": "03:30", 
        "text": "useState Hook",
        "reason": "Emphasize topic transition"
      }
    ],
    "improvements": [
      {
        "category": "pacing",
        "suggestion": "Speed up intro section (0:00-1:00) to maintain engagement"
      }
    ]
  }
}
```

### 💪 Strengths
- **Cheap** - $0.40 per video
- **Smart suggestions** - Understands content context
- **Easy setup** - Just OpenAI API key
- **Editing-focused** - Actionable recommendations
- **Fast** - No long processing time

### ⚠️ Limitations
- **REQUIRES transcript** - Must have audio transcription first
- **Cannot see video** - Only analyzes what's said
- **Blind to visuals** - Misses on-screen text, objects, faces
- **Text-only** - Can't detect scene changes visually
- **Can hallucinate** - Might make up speakers if not careful

---

## 🎨 OpenAI GPT-4 Vision (Frame-Based)

**Cost:** ~$0.80 per video  
**Status:** 🚧 Not implemented yet

### ✅ What it Would Provide
- **Visual + Content Analysis** - Sees frames AND understands context
- **Frame-by-frame insights** - Analyzes extracted video frames
- **Smart scene detection** - Understands visual transitions
- **On-screen text reading** - Can read text in frames
- **Visual quality feedback** - Lighting, composition notes

### ⚠️ Requires
- Frame extraction from video
- Sending multiple images to API
- Higher API costs per video

---

## 🏆 Recommendation

### For Visual Content (Gaming, Sports, Vlogs)
**Use Google Cloud Video Intelligence**
- Detects visual elements automatically
- No audio/transcript needed
- Better for action-heavy content

### For Talking Head / Educational / Podcasts  
**Use OpenAI GPT-4o-mini** ✅ (Current default)
- Much cheaper ($0.40 vs $1.25)
- Better editing suggestions
- Understands spoken content
- Requires transcription first

### Switch between providers
Set `NEXT_PUBLIC_VIDEO_ANALYSIS_PROVIDER` in `.env.local`:
- `google` - Visual analysis
- `openai` - Transcript-based analysis  
- `openai-vision` - Frame-based (not ready)

---

## 📊 Side-by-Side Example

**Same video analyzed:**

### Google Cloud sees:
- "Person talking"
- "Computer screen visible"
- "Text: 'React Hooks' at 0:30"
- 3 scene changes detected
- 1 face tracked

### OpenAI GPT-4o-mini reads transcript and suggests:
- "Cut the 5-second pause at 2:15"
- "Add text overlay 'useState Hook' at 3:30"  
- "Speed up intro (0:00-1:00) for better pacing"
- "Highlight code example at 5:45"
- Main topic: "React hooks tutorial"

**Google tells you WHAT is in the video**  
**OpenAI tells you HOW to edit it**

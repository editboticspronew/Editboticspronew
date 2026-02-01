# AI Video Analysis - Testing Guide

## 🎁 Free Tier Summary

### Google Cloud Video Intelligence (RECOMMENDED FOR TESTING)
- **Free Quota**: 1,000 minutes per month
- **Equivalent Videos**: ~50-100 videos (depending on video length)
- **Duration**: Forever (renews monthly)
- **Best For**: Testing, development, low-volume production

#### Example Math:
- 10-minute videos: 100 free videos per month
- 5-minute videos: 200 free videos per month
- 2-minute videos: 500 free videos per month

### OpenAI GPT-4
- **Free Credits**: $5 (new accounts only)
- **Equivalent Videos**: ~10-15 videos
- **Duration**: 3 months then expires
- **Best For**: Quick testing, then switch to paid

---

## 🚀 Setup for Free Testing

### Option 1: Google Cloud (Best for Extended Testing)

1. **Create Google Cloud Project**
   ```
   https://console.cloud.google.com/
   ```

2. **Enable Video Intelligence API**
   ```
   Navigation: APIs & Services > Library > Video Intelligence API > Enable
   ```

3. **Create Service Account**
   ```
   IAM & Admin > Service Accounts > Create Service Account
   - Name: video-analysis-sa
   - Role: Video Intelligence API User
   - Create and download JSON key
   ```

4. **Configure Environment**
   ```bash
   # .env.local
   NEXT_PUBLIC_VIDEO_ANALYSIS_PROVIDER=google
   NEXT_PUBLIC_GOOGLE_CLOUD_KEY={"type":"service_account",...}
   ```

5. **Test for Free**
   - Analyze up to 1,000 minutes per month
   - No credit card required initially
   - Monitor usage in Google Cloud Console

### Option 2: OpenAI (Quick Start)

1. **Get API Key**
   ```
   https://platform.openai.com/api-keys
   ```

2. **Check Free Credits**
   ```
   https://platform.openai.com/usage
   ```

3. **Configure Environment**
   ```bash
   # .env.local
   NEXT_PUBLIC_VIDEO_ANALYSIS_PROVIDER=openai
   NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-...
   ```

4. **Test Limitations**
   - $5 credits = ~10-15 video analyses
   - Expires after 3 months
   - Then requires paid plan

---

## 💡 Testing Strategy

### Phase 1: Initial Testing (First Week)
**Use**: Google Cloud (free tier)
- Test all features with real videos
- Try different video lengths and types
- Debug any issues without cost concerns
- Quota: 1,000 minutes covers extensive testing

### Phase 2: Production Decision (After Testing)

**Option A - Low Volume** (< 50 videos/month)
- **Keep Google Cloud**
- Stay within free tier forever
- Best feature set

**Option B - High Volume** (> 100 videos/month)
- **Switch to OpenAI**
- Lower per-video cost ($0.40 vs $1.25)
- Simpler setup
- Trade-off: Text-only analysis

**Option C - Hybrid**
```typescript
// Use Google for premium features on select videos
// Use OpenAI for bulk/routine analysis
```

---

## 📊 Cost Calculator

### Google Cloud Pricing After Free Tier

| Video Length | Free/Month | Cost per 1,000 videos |
|--------------|------------|----------------------|
| 2 minutes    | 500 videos | $1,250               |
| 5 minutes    | 200 videos | $1,250               |
| 10 minutes   | 100 videos | $1,250               |

### OpenAI Pricing

| Analysis Type | Cost per Video | Cost per 1,000 videos |
|--------------|----------------|----------------------|
| Text-only    | $0.40          | $400                 |
| Vision       | $0.80          | $800                 |

### Savings Example (1,000 videos/month)

| Provider     | Monthly Cost | Annual Cost |
|--------------|--------------|-------------|
| Google Cloud | $1,250       | $15,000     |
| OpenAI Text  | $400         | $4,800      |
| **Savings**  | **$850/mo**  | **$10,200/yr** |

---

## 🎯 Recommendations

### For Testing (You Right Now)
```bash
# Use Google Cloud - 1,000 minutes FREE
NEXT_PUBLIC_VIDEO_ANALYSIS_PROVIDER=google
```
**Why**: Test extensively without worrying about costs

### For Production
1. **Low volume**: Stay on Google free tier
2. **High volume**: Switch to OpenAI
3. **Premium needs**: Pay for Google Cloud

---

## 🔍 Monitoring Usage

### Google Cloud
```
Console > APIs & Services > Dashboard > Video Intelligence API
```
- View minutes used this month
- Set up billing alerts
- Monitor quota usage

### OpenAI
```
https://platform.openai.com/usage
```
- View API costs by day
- Set spending limits
- Track token usage

---

## ⚠️ Important Notes

1. **Google Cloud**: Requires credit card after free trial, but won't charge within free tier
2. **OpenAI**: Requires payment method after free credits expire
3. **Feature Toggle**: Switch providers anytime without code changes
4. **Testing Videos**: Use short videos (1-2 min) to maximize free tier testing

---

## 🛠️ Quick Commands

### Check Current Provider
```typescript
import { getProviderDisplayName, getProviderFreeTier } from '@/lib/ai';

console.log(getProviderDisplayName()); // "Google Cloud Video Intelligence"
console.log(getProviderFreeTier());    // "1,000 minutes per month FREE"
```

### Switch Provider
```bash
# In .env.local - just change one line
NEXT_PUBLIC_VIDEO_ANALYSIS_PROVIDER=google   # Testing
NEXT_PUBLIC_VIDEO_ANALYSIS_PROVIDER=openai   # Production
```

# Quick CORS Fix Using Firebase Console

## Step-by-Step Instructions

### Using Firebase Console Cloud Shell (No Installation Required)

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/project/editbotics-326dd
   - Make sure you're logged in

2. **Open Cloud Shell**
   - Look for the terminal icon (>_) in the top-right corner of the page
   - Click it to open Cloud Shell at the bottom of the page

3. **Run These Commands**
   ```bash
   # Create CORS configuration file
   cat > /tmp/cors.json << 'EOF'
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Authorization", "Content-Length"]
     }
   ]
   EOF
   
   # Apply CORS to your bucket
   gsutil cors set /tmp/cors.json gs://editbotics-326dd.firebasestorage.app
   
   # Verify it worked
   gsutil cors get gs://editbotics-326dd.firebasestorage.app
   ```

4. **Verify Output**
   - You should see the CORS configuration displayed
   - If successful, close Cloud Shell and test your export again

### Alternative: Google Cloud Console (Web UI)

1. **Open Google Cloud Storage**
   - Go to: https://console.cloud.google.com/storage/browser
   - Select your Firebase project

2. **Find Your Bucket**
   - Look for: `editbotics-326dd.firebasestorage.app`
   - Click on the bucket name

3. **Edit CORS Configuration**
   - Click on the "Configuration" tab
   - Scroll to "CORS configuration"
   - Click "Edit CORS"
   - Paste this:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Authorization", "Content-Length"]
     }
   ]
   ```
   - Click "Save"

## Why This Is Needed

Your **Firebase Storage Rules** (which you showed) control **WHO** can access files (authentication/authorization).

**CORS Configuration** controls **HOW** browsers can access files (cross-origin requests).

Even though your rules allow authenticated users to read files, the browser blocks JavaScript from reading the response without CORS headers.

## After Setting CORS

Once CORS is configured:
1. Restart your dev server: `npm run dev`
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try exporting again

The video export should work immediately!

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase/init';

export interface UploadProgress {
  progress: number;
  url?: string;
  error?: string;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * Upload a file to Firebase Storage with progress tracking
 * @param file - File to upload
 * @param path - Storage path (e.g., 'projects/userId/projectId/filename.mp4')
 * @param onProgress - Callback for progress updates
 * @returns Promise with download URL
 */
export const uploadFile = (
  file: File,
  path: string,
  onProgress?: UploadProgressCallback
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    
    // Set metadata with correct content type
    const metadata = {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
      }
    };
    
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.({ progress });
      },
      (error) => {
        const errorMessage = `Upload failed: ${error.message}`;
        onProgress?.({ progress: 0, error: errorMessage });
        reject(new Error(errorMessage));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onProgress?.({ progress: 100, url });
          resolve(url);
        } catch (error: any) {
          const errorMessage = `Failed to get download URL: ${error.message}`;
          onProgress?.({ progress: 0, error: errorMessage });
          reject(new Error(errorMessage));
        }
      }
    );
  });
};

/**
 * Delete a file from Firebase Storage
 * @param path - Storage path to delete
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error: any) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Upload video to Firebase Storage and return URL + gs:// path
 * @param file - Video file to upload
 * @param videoType - Type category (e.g., 'news', 'training')
 * @returns Promise with download URL and storage path
 */
export const uploadVideoToFirebase = async (
  file: File,
  videoType: string
): Promise<{ url: string; storagePath: string }> => {
  try {
    // Check if user is authenticated
    const { auth } = await import('@/lib/firebase/init');
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('You must be logged in to upload videos. Please sign in and try again.');
    }
    
    // Generate unique filename with user ID
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    // Use projects/{userId} path to match Firebase Storage security rules
    const storagePath = `projects/${user.uid}/${videoType}/${filename}`;
    
    console.log('📤 Uploading to Firebase:', storagePath);
    
    // Upload file
    const url = await uploadFile(file, storagePath);
    
    // Get gs:// format path for Google Cloud
    const bucketName = storage.app.options.storageBucket;
    const gsPath = `gs://${bucketName}/${storagePath}`;
    
    console.log('✅ Upload complete:', { url, gsPath });
    
    return {
      url, // https:// URL for browser access
      storagePath: gsPath, // gs:// path for Google Cloud Video Intelligence
    };
  } catch (error: any) {
    console.error('❌ Upload failed:', error);
    throw new Error(`Failed to upload video: ${error.message}`);
  }
};


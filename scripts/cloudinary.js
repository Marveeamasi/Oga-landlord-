const CLOUDINARY_CLOUD_NAME = 'dsfqihvjz'; // Replace with yours
const CLOUDINARY_UPLOAD_PRESET = 'unsigned_preset_name'; // Create one in Cloudinary dashboard: Settings > Upload > Upload presets > Add (unsigned mode)

// Function to upload file to Cloudinary
export async function uploadToCloudinary(file, maxSizeMB = 1) {
  if (!file) return null;

  let processedFile = file;

  // Compress images only (videos not compressed, but check size)
  if (file.type.startsWith('image/')) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      try {
        // Use globally available imageCompression from CDN
        if (!window.imageCompression) {
          throw new Error('Image compression library not loaded');
        }
        processedFile = await window.imageCompression(file, {
          maxSizeMB,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        });
      } catch (err) {
        throw new Error('Image compression failed: ' + err.message);
      }
    }
  } else if (file.type.startsWith('video/')) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Video size must be ≤10MB');
    }
    // No compression for videos
  }

  const formData = new FormData();
  formData.append('file', processedFile);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
  formData.append('folder', 'media'); // Organize uploads

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  const data = await response.json();
  return data.secure_url; // Optimized URL
}
const cloudinary = require("cloudinary").v2;

function initCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials missing: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  console.log("✅ Cloudinary initialized");
}

async function uploadImage(fileBuffer, folder, prefix) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `mandir/${folder}`,
        public_id: `${prefix}-${Date.now()}`,
        resource_type: "image",
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(new Error(`Image upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
}

async function uploadAudio(fileBuffer, folder, prefix) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `mandir/${folder}`,
        public_id: `${prefix}-${Date.now()}`,
        resource_type: "video", // Audio files use video resource type in Cloudinary
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
}

async function deleteAsset(url) {
  if (!url || !url.includes("cloudinary.com")) return; // Not a Cloudinary URL

  try {
    const publicId = extractPublicId(url);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.warn(`Failed to delete Cloudinary asset: ${error.message}`);
  }
}

function extractPublicId(url) {
  // Extract public_id from Cloudinary URL
  // Format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{public_id}
  const match = url.match(/\/upload\/(.+?)(?:\.|$)/);
  return match ? match[1] : null;
}

module.exports = {
  initCloudinary,
  uploadImage,
  uploadAudio,
  deleteAsset,
};

import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'meetflow',
      resource_type: 'auto', // Important for videos
      allowed_formats: ['jpg', 'png', 'mp4', 'mov'],
      public_id: `file-${Date.now()}`
    };
  },
});

export const uploadCloudinary = multer({ storage: storage });
export { cloudinary };

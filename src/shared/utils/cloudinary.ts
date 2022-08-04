import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  secure: true,
});

export async function uploadNftImageCloudinary(url: string) {
  return await cloudinary.uploader.upload(url, {
    transformation: {
      width: 400,
      crop: 'scale',
    },
  });
}

export async function uploadImageCloudinary(path: string, width: number) {
  return await cloudinary.uploader.upload(path, {
    transformation: {
      width,
      crop: 'scale',
    },
  });
}

export async function uploadBannerImageCloudinary(path: string) {
  return await cloudinary.uploader.upload(path);
}

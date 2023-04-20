// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import {
  ImageTransformationOptions,
  TransformationOptions,
  v2 as cloudinary,
} from 'cloudinary';

cloudinary.config({
  secure: true,
});

export async function uploadNftImageCloudinary(url: string) {
  return await cloudinary.uploader.upload(url, {
    folder: 'nfts',
    transformation: {
      height: 600,
      crop: 'scale',
    },
  });
}

export async function uploadImageCloudinary(path: string, width: number) {
  return await cloudinary.uploader.upload(path, {
    folder: 'thumbnails',
    transformation: {
      width,
      crop: 'scale',
    },
  });
}

export async function uploadBannerImageCloudinary(path: string) {
  return await cloudinary.uploader.upload(path, {
    folder: 'banners',
  });
}

export async function uploadImageToCloudinary(
  path: string,
  folder: string,
  transformation?: ImageTransformationOptions,
) {
  const options: TransformationOptions = {
    quality: 'auto',
    fetch_format: 'auto',
    ...(transformation || {}),
  };
  return await cloudinary.uploader.upload(path, {
    folder,
    transformation: options,
  });
}

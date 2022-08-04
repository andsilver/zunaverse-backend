// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    console.log(
      process.env.CLOUDINARY_URL,
      cloudinary.config({
        secure: true,
      }),
    );
  }

  async uploadNftImageCloudinary(url: string) {
    return await cloudinary.uploader.upload(url, {
      folder: 'zunaverse/nfts',
      transformation: {
        width: 400,
        crop: 'scale',
      },
    });
  }

  async uploadImageCloudinary(path: string, width: number) {
    return await cloudinary.uploader.upload(path, {
      folder: 'zunaverse/thumbnails',
      transformation: {
        width,
        crop: 'scale',
      },
    });
  }

  async uploadBannerImageCloudinary(path: string) {
    return await cloudinary.uploader.upload(path, {
      folder: 'zunaverse/banners',
    });
  }
}

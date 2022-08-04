// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      secure: true,
    });
  }

  async uploadNftImageCloudinary(url: string) {
    return await cloudinary.uploader.upload(url, {
      folder: 'nfts',
      transformation: {
        width: 400,
        crop: 'scale',
      },
    });
  }

  async uploadImageCloudinary(path: string, width: number) {
    return await cloudinary.uploader.upload(path, {
      folder: 'thumbnails',
      transformation: {
        width,
        crop: 'scale',
      },
    });
  }

  async uploadBannerImageCloudinary(path: string) {
    return await cloudinary.uploader.upload(path, {
      folder: 'banners',
    });
  }
}

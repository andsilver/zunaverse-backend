import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { Collection } from './database/entities/Collection';
import { Nft } from './database/entities/Nft';
import { User } from './database/entities/User';
import { CloudinaryService } from './shared/services/cloudinary.service';

@Injectable()
export class FixService {
  constructor(private cloudinary: CloudinaryService) {}

  async addNftThumbnail() {
    const nfts = await Nft.find({
      where: {
        thumbnail: IsNull(),
      },
    });

    for (const nft of nfts) {
      const { secure_url } = await this.cloudinary.uploadNftImageCloudinary(
        nft.image.replace('ipfs://', process.env.PINATA_GATE_WAY),
      );
      nft.thumbnail = secure_url;
    }
    await Nft.save(nfts);

    const users = await User.find({});

    for (const user of users) {
      const [
        { secure_url: avatarUrl },
        { secure_url: thumbnailUrl },
        { secure_url: bannerUrl },
      ] = await Promise.all([
        user.avatar
          ? this.cloudinary.uploadImageCloudinary(user.avatar, 200)
          : Promise.resolve({ secure_url: null }),
        user.avatar
          ? this.cloudinary.uploadImageCloudinary(user.avatar, 60)
          : Promise.resolve({ secure_url: null }),
        user.banner
          ? this.cloudinary.uploadBannerImageCloudinary(user.banner)
          : Promise.resolve({ secure_url: null }),
        ,
      ]);
      user.avatar = avatarUrl;
      user.thumbnail = thumbnailUrl;
      user.banner = bannerUrl;
      await user.save();
    }

    const collections = await Collection.find({});

    for (const collection of collections) {
      const [{ secure_url: imageUrl }, { secure_url: bannerUrl }] =
        await Promise.all([
          collection.image
            ? this.cloudinary.uploadImageCloudinary(collection.image, 200)
            : Promise.resolve({ secure_url: null }),
          collection.banner
            ? this.cloudinary.uploadBannerImageCloudinary(collection.banner)
            : Promise.resolve({ secure_url: null }),
          ,
        ]);
      collection.image = imageUrl;
      collection.banner = bannerUrl;
      await collection.save();
    }
  }
}

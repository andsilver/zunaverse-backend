import { Injectable, Logger } from '@nestjs/common';
import { Nft } from './database/entities/Nft';

@Injectable()
export class FixService {
  async fixTokenId() {
    const nfts = await Nft.find({});

    for (const nft of nfts) {
      const tokenId = nft.tokenId;
      nft.fixTokenId();

      if (tokenId !== nft.tokenId) {
        await nft.save();

        Logger.log(`${tokenId} -> ${nft.tokenId}`);
      }
    }
  }
}

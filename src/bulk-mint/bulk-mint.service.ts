import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import Web3 from 'web3';

import { BulkMintRequest } from 'src/database/entities/BulkMintRequest';
import { TempNft } from 'src/database/entities/TempNft';
import MediaAbi from '../indexer/abis/Zuna.json';
import MarketAbi from '../indexer/abis/Market.json';
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class BulkMintService {
  logger = new Logger(BulkMintService.name);

  constructor(private queue: QueueService) {}

  async processRequest(id: number) {
    const req = await BulkMintRequest.findOneBy({ id });

    if (!req) {
      throw new UnprocessableEntityException('Not found entity');
    }

    if (req.status === 'processing') {
      throw new BadRequestException('In progress already');
    }

    if (req.status === 'success' || req.status === 'minted') {
      const web3 = new Web3(
        new Web3.providers.HttpProvider(process.env.HTTPS_RPC_URL),
      );
      const media = new web3.eth.Contract(
        MediaAbi as any,
        process.env.MEDIA_CONTRACT,
      );
      const market = new web3.eth.Contract(
        MarketAbi as any,
        process.env.MARKET_CONTRACT,
      );

      if (req.status === 'success') {
        const nft = await TempNft.findOneBy({
          requestId: req.id,
          tokenUri: Not(IsNull()),
        });

        try {
          await media.methods.ownerOf(nft.tokenId).call();
          req.status = 'minted';
        } catch (err) {
          throw new BadRequestException('You can mint your nfts now');
        }
      }

      const nft = await TempNft.findOneBy({
        requestId: req.id,
        tokenUri: Not(IsNull()),
        amount: Not('0'),
      });
      const price = await market.methods.prices(nft.tokenId).call();

      if (nft.amount === price.amount) {
        req.status = 'completed';
        await req.save();

        throw new BadRequestException(
          'The request already has been completed successfully',
        );
      } else {
        await req.save();
        throw new BadRequestException(
          'Nfts are already minted, please set price now',
        );
      }
    }
    await this.queue.processBulkMint(req.id);
  }
}

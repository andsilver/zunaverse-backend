import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnprocessableEntityException,
} from '@nestjs/common';
import fs from 'fs';
import { BulkMintRequest } from 'src/database/entities/BulkMintRequest';
import { TempNft } from 'src/database/entities/TempNft';
import { pinata } from 'src/shared/utils/pinata';
import Web3 from 'web3';
import MediaAbi from '../indexer/abis/Zuna.json';
import MarketAbi from '../indexer/abis/Market.json';
import { BURN_ADDRESSES } from 'src/consts';
import { Not } from 'typeorm';

@Injectable()
export class BulkMintService implements OnApplicationBootstrap {
  queue = 0;
  inProgress = false;
  logger = new Logger(BulkMintService.name);

  onApplicationBootstrap() {
    this.queueRequest();
  }

  queueRequest() {
    this.queue += 1;
  }

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
          processed: true,
        });
        const owner = await media.methods.ownerOf(nft.tokenId).call();

        if (owner !== BURN_ADDRESSES[0]) {
          req.status = 'minted';
        }
      }

      const nft = await TempNft.findOneBy({
        requestId: req.id,
        processed: true,
        amount: Not('0'),
      });
      const price = await market.methods.prices(nft.tokenId).call();

      if (nft.amount === price.amount) {
        req.status = 'completed';
        await req.save();

        throw new BadRequestException(
          'The request has been completed successfully',
        );
      } else {
        await req.save();
        throw new BadRequestException('Nfts are minted, please set price now');
      }
    }

    const tempNfts = await TempNft.find({
      where: { requestId: req.id, processed: false },
      order: {
        id: 'ASC',
      },
    });

    if (req.status === 'init' || req.status === 'uploading') {
      if (tempNfts.length < req.totalNfts) {
        throw new BadRequestException('Awaiting for nfts uploading to be done');
      }

      if (tempNfts.length > req.totalNfts) {
        await req.removeRequest();
        throw new BadRequestException('Invalid minting request, removed');
      }
    }
    req.status = 'processing';
    await req.save();

    for (const tempNft of tempNfts) {
      try {
        const readableStreamForFile = fs.createReadStream(tempNft.filePath);
        const res = await pinata.pinFileToIPFS(readableStreamForFile);
        tempNft.imageIpfsHash = res.IpfsHash;

        const metadata = {
          name: tempNft.name,
          description: tempNft.description,
          category: tempNft.category,
          image: `ipfs://${res.IpfsHash}`,
          properties: tempNft.properties,
        };
        const metadataRes = await pinata.pinJSONToIPFS(metadata);
        tempNft.tokenUri = `ipfs://${metadataRes.IpfsHash}`;
        tempNft.processed = true;
        await tempNft.save();
        fs.unlinkSync(tempNft.filePath);
      } catch (err) {
        this.logger.error(`Failed at processing: ${tempNft.id}`);
        console.error(err);
        req.status = 'failed';
        await req.save();
        return;
      }
    }
    req.status = 'success';
    await req.save();
  }
}

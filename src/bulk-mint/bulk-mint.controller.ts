import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { BulkMintRequest } from 'src/database/entities/BulkMintRequest';
import { Currency } from 'src/database/entities/Currency';
import { StreamEvent } from 'src/database/entities/StreamEvent';
import { TempNft } from 'src/database/entities/TempNft';
import { User } from 'src/database/entities/User';
import { IndexerService } from 'src/indexer/indexer.service';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { eventManager } from 'src/shared/utils/contract-events';
import { IndexDto, UploadNftDto } from './bulk-mint.dto';
import { BulkMintService } from './bulk-mint.service';
import { Collection } from 'src/database/entities/Collection';

@Controller('bulk-mint')
export class BulkMintController {
  constructor(
    private bulkMintService: BulkMintService,
    private indexer: IndexerService,
  ) {}

  @Get(':id')
  @UseGuards(AuthGuard)
  async getBulkMintRequest(@Param('id') id: string) {
    const req = await BulkMintRequest.findOneBy({ id: +id });
    const collection = await Collection.findOneBy({ id: req.collectionId });

    if (!req || !collection) {
      throw new UnprocessableEntityException('No request found');
    }
    req.collection = collection;
    const tempNfts = await TempNft.find({
      where: { requestId: req.id },
      order: { id: 'ASC' },
    });
    req.processedNfts = tempNfts.filter((n) => n.tokenUri).length;
    req.uploadedNfts = tempNfts.length;

    return { req, tempNfts };
  }

  @Get(':id/collection')
  @UseGuards(AuthGuard)
  async getBulkMintCollection(@Param('id') id: string) {
    const req = await BulkMintRequest.findOneBy({ id: +id });

    if (!req) {
      throw new UnprocessableEntityException('No request found');
    }
    return await Collection.findOneBy({ id: req.collectionId });
  }

  @Post(':id/index/mint')
  @UseGuards(AuthGuard)
  async indexMint(
    @Param('id') id: string,
    @Body() body: IndexDto,
    @CurrentUser() user: User,
  ) {
    const req = await BulkMintRequest.findOneBy({ id: +id });

    if (!req) {
      throw new UnprocessableEntityException('The request does not exist');
    }

    if (req.userId !== user.id) {
      throw new BadRequestException('Not the owner');
    }
    const { block, logs } = body;

    if (logs.length !== req.totalNfts) {
      throw new BadRequestException('Logs number not matching');
    }
    const existing = await StreamEvent.findOneBy({
      blockNumber: +body.block.number,
      txHash: body.logs[0].transactionHash,
      logIndex: +body.logs[0].logIndex,
    });

    if (existing) {
      throw new ConflictException('Logs are already existing');
    }
    await eventManager.saveLogs(block, logs);
    this.indexer.queueIndex();

    req.status = 'minted';
    return await req.save();
  }

  @Post(':id/index/set-price')
  @UseGuards(AuthGuard)
  async indexPriceSet(
    @Param('id') id: string,
    @Body() body: IndexDto,
    @CurrentUser() user: User,
  ) {
    const req = await BulkMintRequest.findOneBy({ id: +id });

    if (!req) {
      throw new UnprocessableEntityException('The request does not exist');
    }

    if (req.userId !== user.id) {
      throw new BadRequestException('Not the owner');
    }
    const { block, logs } = body;
    const existing = await StreamEvent.findOneBy({
      blockNumber: +body.block.number,
      txHash: body.logs[0].transactionHash,
      logIndex: +body.logs[0].logIndex,
    });

    if (existing) {
      throw new ConflictException('Logs are already existing');
    }
    await eventManager.saveLogs(block, logs);
    this.indexer.queueIndex();

    req.status = 'completed';
    return await req.save();
  }

  @Post(':id/process')
  @UseGuards(AuthGuard)
  async processRequest(@Param('id') id: string) {
    await this.bulkMintService.processRequest(+id);
  }

  @Post(':id/upload-nft')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadNft(
    @Param('id') id: string,
    @Body() body: UploadNftDto,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const {
      name,
      description,
      category,
      erc20Address,
      amount,
      properties,
      royaltyFee,
      tokenId,
    } = body;

    const [req, currency] = await Promise.all([
      BulkMintRequest.findOneBy({ id: +id }),
      erc20Address === '0x0000000000000000000000000000000000000000'
        ? true
        : Currency.findOneBy({ address: erc20Address.toLowerCase() }),
    ]);

    if (!req) {
      throw new UnprocessableEntityException('No request found');
    }

    if (req.userId !== user.id) {
      throw new UnauthorizedException('Only request creator can process it');
    }

    if (!currency) {
      throw new BadRequestException('Unsupported currency');
    }

    const tempNft = await TempNft.createTempNft(
      tokenId,
      name,
      description,
      category,
      JSON.parse(properties),
      +royaltyFee,
      file.path,
      user.id,
      null,
      erc20Address,
      amount,
      req.collectionId,
      req.id,
      true,
    );
    await tempNft.save();

    if (req.status === 'init') {
      req.status = 'uploading';
      await req.save();
    }
    return tempNft;
  }
}

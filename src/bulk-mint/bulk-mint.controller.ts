import {
  BadRequestException,
  Body,
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
import { TempNft } from 'src/database/entities/TempNft';
import { User } from 'src/database/entities/User';

import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { UploadNftDto } from './bulk-mint.dto';
import { BulkMintService } from './bulk-mint.service';

@Controller('bulk-mint')
export class BulkMintController {
  constructor(private bulkMintService: BulkMintService) {}

  @Get(':id')
  @UseGuards(AuthGuard)
  async getBulkMintRequest(@Param('id') id: string) {
    const req = await BulkMintRequest.findOneBy({ id: +id });

    if (!req) {
      throw new UnprocessableEntityException('No request found');
    }
    const tempNfts = await TempNft.find({
      where: { requestId: req.id },
      order: { id: 'ASC' },
    });
    req.processedNfts = tempNfts.filter((n) => n.processed).length;
    req.uploadedNfts = tempNfts.length;

    return { req, tempNfts };
  }

  @Post(':id/process')
  @UseGuards(AuthGuard)
  async processRequest(@Param('id') id: string) {
    await this.bulkMintService.processRequest(+id);
  }

  @Post(':id/process/complete')
  @UseGuards(AuthGuard)
  async completeRequest(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() body: any,
  ) {
    const req = await BulkMintRequest.findOneBy({ id: +id });

    if (!req) {
      throw new UnprocessableEntityException('No request found');
    }

    if (req.userId !== user.id) {
      throw new UnauthorizedException('Only request creator can process it');
    }
    const { status } = body;
    req.status = status || 'minted';
    await req.save();

    return req;
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

    const tempNft = await TempNft.create({
      name,
      description,
      category,
      erc20Address,
      amount,
      properties: JSON.parse(properties),
      royaltyFee,
      userId: user.id,
      collectionId: req.collectionId,
      requestId: req.id,
      filePath: file.path,
      tokenId,
    }).save();

    if (req.status === 'init') {
      req.status = 'uploading';
      await req.save();
    }
    return tempNft;
  }
}

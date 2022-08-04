import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import fs from 'fs';
import pinataSDK from '@pinata/sdk';
import { AuthGuard } from 'src/shared/guards/auth.guard';

const pinata = pinataSDK(
  process.env.PINATA_CLOUD_API_KEY,
  process.env.PINATA_CLOUD_API_SECRET,
);

@Controller('pinata')
export class PinataController {
  @Post('file')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async pinFile(@UploadedFile() file: Express.Multer.File) {
    const readableStreamForFile = fs.createReadStream(file.path);
    const res = await pinata.pinFileToIPFS(readableStreamForFile);
    return res;
  }

  @Post('json')
  @UseGuards(AuthGuard)
  async pinJson(@Body() body: any) {
    return await pinata.pinJSONToIPFS(body);
  }
}

import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import fs from 'fs';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { pinata } from 'src/shared/utils/pinata';

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

  @Post('files')
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('files'))
  async pinFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    const result = [];

    for (const file of files) {
      const readableStreamForFile = fs.createReadStream(file.path);
      const res = await pinata.pinFileToIPFS(readableStreamForFile);
      result.push(res);
      fs.unlinkSync(file.path);
    }
    return result;
  }

  @Post('json')
  @UseGuards(AuthGuard)
  async pinJson(@Body() body: any) {
    return await pinata.pinJSONToIPFS(body);
  }

  @Post('jsons')
  @UseGuards(AuthGuard)
  async pinJsons(@Body() body: any[]) {
    const result = [];

    for (const item of body) {
      result.push(await pinata.pinJSONToIPFS(item));
    }
    return result;
  }
}

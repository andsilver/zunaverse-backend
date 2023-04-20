import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { uploadImageToCloudinary } from 'src/shared/utils/cloudinary';

@Controller('file-upload')
export class FileUploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const { secure_url } = await uploadImageToCloudinary(file.path, 'files');
    return { location: secure_url };
  }
}

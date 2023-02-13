import { IsNumberString, IsString, IsNotEmpty } from 'class-validator';

export class UploadNftDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  erc20Address: string;

  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @IsNotEmpty()
  @IsString()
  properties: string;

  @IsNotEmpty()
  @IsNumberString()
  royaltyFee: number;

  @IsString()
  tokenId: string;
}

import {
  IsBooleanString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { NftCategory } from 'src/shared/types';

export class CreateNftDto {
  @IsNumber()
  @IsNotEmpty()
  tempNftId: number;

  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class CreateTempNftDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(NftCategory)
  @IsOptional()
  category: NftCategory;

  @IsNumberString()
  @IsNotEmpty()
  royaltyFee: string;

  @IsNumberString()
  @IsOptional()
  collectionId: string;

  @IsString()
  @IsNotEmpty()
  tokenId: string;

  @IsString()
  @IsOptional()
  properties: string;

  @IsBooleanString()
  @IsOptional()
  onSale: string;
}

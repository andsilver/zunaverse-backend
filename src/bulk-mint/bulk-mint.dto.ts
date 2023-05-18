import {
  IsNumberString,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsNotEmptyObject,
  IsOptional,
} from 'class-validator';
import { NftCategory } from 'src/shared/types';
import { Block, Log } from '@moralisweb3/streams-typings';

export class UploadNftDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(NftCategory)
  @IsNotEmpty()
  category: NftCategory;

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

  @IsString()
  @IsOptional()
  tier: string;
}

export class IndexDto {
  @IsArray()
  logs: Log[];

  @IsNotEmptyObject()
  block: Block;
}

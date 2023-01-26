import { UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';
import { Nft } from './Nft';

@Entity('ShortLinks')
export class ShortLink extends BaseEntity {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  collectionId: number;

  static async findOrCreate(tokenAddress: string, tokenId: string) {
    let shortlink = await ShortLink.findOneBy({
      tokenAddress,
      tokenId,
    });

    if (!shortlink) {
      const nft =
        (await Nft.findOneBy({
          tokenAddress,
          tokenId,
        })) || (await Nft.getNftFromMoralis(tokenAddress, tokenId));

      if (!nft) {
        throw new UnprocessableEntityException('The nft does not exist');
      }

      shortlink = await ShortLink.create({
        id: randomUUID(),
        tokenAddress,
        tokenId,
      }).save();
    }
    return shortlink;
  }
}

import { BaseEntity, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import _ from 'lodash';

@Entity('ShortLinks')
@Index(['tokenAddress', 'tokenId'], {
  unique: true,
  spatial: false,
})
export class ShortLink extends BaseEntity {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  collectionId: number;

  @Column({ nullable: true })
  blogId: number;

  async saveWithId(name: string) {
    const id = _.kebabCase(name).split('-').slice(0, 15).join('-');

    if (id === this.id) {
      return;
    }
    let existing = await ShortLink.findOneBy({ id });
    let tempId = id;

    while (existing) {
      tempId = id + '-' + Math.random().toString(36).slice(7);
      existing = await ShortLink.findOneBy({ id: tempId });
    }

    if (this.id) {
      await this.remove();
    }
    this.id = tempId;
    return await this.save();
  }
}

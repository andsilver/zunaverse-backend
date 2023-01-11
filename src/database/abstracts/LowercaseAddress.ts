import { BaseEntity, BeforeInsert, BeforeUpdate } from 'typeorm';
import Web3 from 'web3';

export abstract class LowercaseAddressEntityAbstract extends BaseEntity {
  @BeforeUpdate()
  @BeforeInsert()
  lowercaseAddresses() {
    Object.keys(this).forEach((key) => {
      const value = this[key];

      if (value && typeof value === 'string' && Web3.utils.isAddress(value)) {
        this[key] = value.toLowerCase();
      }
    });
  }
}

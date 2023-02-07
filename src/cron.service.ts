import { EvmChain } from '@moralisweb3/common-evm-utils';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Moralis from 'moralis';

import { Currency } from './database/entities/Currency';
import { Indexer } from './indexer';
import { fetchCoins } from './shared/utils/coingecko';
import { StreamService } from './stream/stream.service';

@Injectable()
export class CronService implements OnApplicationBootstrap {
  indexer: Indexer;

  constructor(private stream: StreamService) {
    this.indexer = new Indexer();
  }

  onApplicationBootstrap() {
    // this.fixNftTransfers();
    // this.fixBulkPriceSet();
  }

  @Cron('*/10 * * * * *')
  handleCron() {
    // if (!process.env.NO_INDEXING) {
    this.indexer.index(this.stream);
    // }
  }

  @Cron('*/30 * * * *')
  async fetchCoins() {
    const currencies = await Currency.find({});
    const prices = await fetchCoins(currencies.map((c) => c.coinId));

    currencies.map((c) => {
      c.usd = +prices[c.coinId].current_price;
    });
    await Currency.save(currencies);
  }

  async fixNftTransfers() {
    const fromBlock = 26949686;

    const chain =
      process.env.NODE_ENV === 'production'
        ? EvmChain.BSC
        : EvmChain.BSC_TESTNET;

    const res = await Moralis.EvmApi.nft.getNFTContractTransfers({
      address: process.env.MEDIA_CONTRACT,
      chain,
      fromBlock,
    });

    const txs = res.toJSON();

    for (const tx of txs.result) {
      await this.stream.handleTransfer(
        tx.token_id,
        tx.token_address,
        tx.transaction_hash,
        tx.from_address,
        tx.to_address,
        tx.log_index,
        tx.block_timestamp,
      );
    }
  }

  async fixBulkPriceSet() {
    const fromBlock = 26949686;

    const chain =
      process.env.NODE_ENV === 'production'
        ? EvmChain.BSC
        : EvmChain.BSC_TESTNET;

    const res = await Moralis.EvmApi.events.getContractEvents({
      chain,
      fromBlock,
      address: process.env.MARKET_CONTRACT,
      topic:
        '0x70c2398672297895be58f2db6fb72c1f5395909f266db7bb25e557545cffdccb',
      abi: {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: 'uint256[]',
            name: 'tokenIds',
            type: 'uint256[]',
          },
        ],
        name: 'BulkPriceSet',
        type: 'event',
      },
    });
    const { result } = res.toJSON();
    console.log(result);

    for (const item of result) {
      await this.stream.handleBulkPriceSet((item.data as any).tokenIds);
    }
  }
}

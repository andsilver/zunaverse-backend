import Web3 from 'web3';
import { Contract, EventData } from 'web3-eth-contract';
import { MarketHandler } from './market-handler';
import { MediaHandler } from './media-handler';
import { EthBlock } from '../database/entities/EthBlock';
import { Logger } from '@nestjs/common';

export class Indexer {
  web3!: Web3;
  media!: Contract;
  Market!: Contract;
  startBlock!: number;
  logger = new Logger(Indexer.name);

  handlers: any = {};

  inProgress = false;

  constructor() {
    this.web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));
    this.startBlock = +process.env.START_BLOCK;
    this.handlers[process.env.MEDIA_CONTRACT] = new MediaHandler(this.web3);
    this.handlers[process.env.MARKET_CONTRACT] = new MarketHandler(this.web3);
  }

  async index() {
    if (this.inProgress) {
      return;
    }
    this.inProgress = true;
    let ethBlock = (await EthBlock.find({}))[0];

    if (!ethBlock) {
      ethBlock = new EthBlock();
      ethBlock.blockNumber = this.startBlock;
      await ethBlock.save();
    }

    await this.processIndex(ethBlock);

    this.inProgress = false;
  }

  // async indexFromStartBlock() {
  //   this.inProgress = true;

  //   await EthBlock.delete({});
  //   await Bid.delete({});
  //   await Nft.delete({});
  //   await Activity.delete({});
  //   await Ask.delete({});

  //   const ethBlock = new EthBlock();
  //   ethBlock.blockNumber = this.startBlock;
  //   await ethBlock.save();

  //   await this.processIndex(ethBlock);

  //   this.inProgress = false;
  // }

  async processIndex(startBlock: EthBlock) {
    const toBlock = await this.web3.eth.getBlockNumber();
    const logs = await this.getLogs(startBlock.blockNumber + 1, toBlock);

    if (!logs.length) {
      startBlock.blockNumber = toBlock;
      await startBlock.save();
      return;
    }

    this.logger.log(`Start: ${startBlock.blockNumber} - ${toBlock}`);

    try {
      for (const log of logs) {
        if (!this.handlers[log.address]) {
          continue;
        }
        await this.handlers[log.address].eventHandler(log);

        if (log.blockNumber !== startBlock.blockNumber) {
          startBlock.blockNumber = log.blockNumber;
          await startBlock.save();
        }
      }
      startBlock.blockNumber = toBlock;
      await startBlock.save();
      this.logger.log(`Success: ${startBlock.blockNumber} - ${toBlock}`);
    } catch (err) {
      this.logger.error(err);
      this.logger.log(
        `Cancel: ${startBlock.blockNumber} - ${startBlock.blockNumber}`,
      );
    }
  }

  async eventHandler(event: EventData) {
    const handlerName = `handle${event.event}`;

    if (this[handlerName]) {
      this[handlerName](event);
    }
  }

  async getLogs(fromBlockNumber: number, toBlock: number | 'latest') {
    const chunkLimit = 4000;

    const toBlockNumber =
      toBlock === 'latest' ? await this.web3.eth.getBlockNumber() : +toBlock;
    const totalBlocks = toBlockNumber - fromBlockNumber;

    const chunks = [];

    if (totalBlocks > chunkLimit) {
      const count = Math.ceil(totalBlocks / chunkLimit);
      let startingBlock = fromBlockNumber;

      for (let index = 0; index < count; index++) {
        const fromRangeBlock = startingBlock;
        const toRangeBlock =
          index === count - 1 ? toBlockNumber : startingBlock + chunkLimit;
        startingBlock = toRangeBlock + 1;

        chunks.push({ fromBlock: fromRangeBlock, toBlock: toRangeBlock });
      }
    } else {
      chunks.push({ fromBlock: fromBlockNumber, toBlock: toBlockNumber });
    }

    const logs = [];

    for (const chunk of chunks) {
      const chunkLogs = await this.web3.eth.getPastLogs({
        fromBlock: chunk.fromBlock,
        toBlock: chunk.toBlock,
        address: [process.env.MEDIA_CONTRACT, process.env.MARKET_CONTRACT],
      });
      logs.push(...chunkLogs);
    }
    return logs;
  }
}

import { Block, Log } from '@moralisweb3/streams-typings';
import Web3 from 'web3';

import { getEventAbi } from 'src/indexer/utils';
import MarketAbi from '../../indexer/abis/Market.json';
import Market2Abi from '../../indexer/abis/Market2.json';
import ZunaAbi from '../../indexer/abis/Zuna.json';
import { StreamEvent } from 'src/database/entities/StreamEvent';
import { ContractType, EventAbi } from '../types';

export class ContractEvents {
  EVENTS: EventAbi[] = [
    {
      name: 'Transfer',
      contract: ContractType.ERC721,
      topic:
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    },
    {
      name: 'OfferAccepted',
      contract: ContractType.Market,
      topic:
        '0xee101220bc97ee214fc4e7643a015f27f7362e7d3bfa1ce8ec911c9ce7ae8ee6',
      address: process.env.MARKET_CONTRACT,
    },
    {
      name: 'Bought',
      contract: ContractType.Market,
      topic:
        '0x0e5399930fdcba38037ada5263bee00f5f587f8cc301ad72d02113fdaea10454',
      address: process.env.MARKET_CONTRACT,
    },
    {
      name: 'BulkPriceSet',
      contract: ContractType.Market,
      topic:
        '0x70c2398672297895be58f2db6fb72c1f5395909f266db7bb25e557545cffdccb',
      address: process.env.MARKET_CONTRACT,
    },
    {
      name: 'RemovePrice',
      contract: ContractType.Market,
      topic:
        '0x69e0c42f8f93a15104bf76fb82e77e46d0af18278924ca1d45f0d087727150b0',
      address: process.env.MARKET_CONTRACT,
    },
    {
      name: 'OfferAccepted',
      contract: ContractType.Market2,
      topic: '',
      address: process.env.MARKET2_CONTRACT,
    },
    {
      name: 'Bought',
      contract: ContractType.Market2,
      topic:
        '0x2da2a946c794e9ad7ceda69deeb5e724c5463c3b98df56b021c26e4148457f63',
      address: process.env.MARKET2_CONTRACT,
    },
  ];

  constructor() {
    for (const event of this.EVENTS) {
      const contractAbi = {
        ERC721: ZunaAbi,
        Market: MarketAbi,
        Market2: Market2Abi,
      }[event.contract];
      event.abi = getEventAbi(contractAbi, event.name);
    }
  }

  async saveLogs(block: Block, logs: Log[]) {
    const existing = await StreamEvent.findOneBy({
      blockNumber: +block.number,
      txHash: logs[logs.length - 1].transactionHash,
      logIndex: +logs[logs.length - 1].logIndex,
    });

    if (existing) {
      return null;
    }
    const events = this.decodeLogs(logs);
    const streamEvents = events.map((e) =>
      StreamEvent.create({
        logIndex: +e.log.logIndex,
        blockNumber: +block.number,
        address: e.log.address,
        data: e.decoded,
        event: e.event,
        processed: false,
        blockTimestamp: block.timestamp,
        txHash: e.log.transactionHash,
      }),
    );
    return await StreamEvent.save(streamEvents);
  }

  decodeLogs(logs: Log[]) {
    const web3 = new Web3(
      new Web3.providers.HttpProvider(process.env.HTTPS_RPC_URL),
    );
    return logs
      .map((log) => {
        const topics = [log.topic1, log.topic2, log.topic3];
        const event = this.EVENTS.find((e) => e.topic === log.topic0);

        if (!event) {
          throw new Error('Invalid Contract Event');
        }
        const { abi, ...eventData } = event;
        const decoded = web3.eth.abi.decodeLog(abi.inputs, log.data, topics);
        console.log(decoded);

        return {
          log,
          decoded,
          event: eventData,
        };
      })
      .filter(Boolean);
  }
}

export const eventManager = new ContractEvents();

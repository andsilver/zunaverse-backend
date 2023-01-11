import { EvmChain } from '@moralisweb3/common-evm-utils';
import Moralis from 'moralis';

export function getChainId() {
  return process.env.NODE_ENV === 'production'
    ? EvmChain.BSC
    : EvmChain.BSC_TESTNET;
}

export async function addNftAddressToStream(address: string) {
  await Moralis.Streams.addAddress({
    networkType: 'evm',
    id: process.env.MORALIS_NFTS_STREAM_ID,
    address,
  });
}

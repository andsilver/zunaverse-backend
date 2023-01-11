import { Injectable } from '@nestjs/common';
import Moralis from 'moralis';
import { PAGINATION } from 'src/consts';
import { getChainId } from '../utils/moralis';

@Injectable()
export class MoralisService {
  async getNftsByAddress(address: string, cursor: string) {
    const chain = getChainId();
    const collections = await Moralis.EvmApi.nft.getWalletNFTCollections({
      address,
      chain,
    });

    const response = await Moralis.EvmApi.nft.getWalletNFTs({
      address,
      chain,
      normalizeMetadata: true,
      limit: PAGINATION,
      tokenAddresses: collections
        .toJSON()
        .result.map((r) => r.token_address)
        .filter(
          (r) => r.toLowerCase() !== process.env.MEDIA_CONTRACT.toLowerCase(),
        ),
      cursor,
    });
    return response.toJSON();
  }

  async getNftMetadata(contractAddress: string, tokenId: string) {
    const chain = getChainId();

    const response = await Moralis.EvmApi.nft.getNFTMetadata({
      address: contractAddress,
      chain,
      tokenId,
    });
    return response.toJSON();
  }
}

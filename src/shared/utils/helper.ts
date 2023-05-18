import { PAGINATION } from 'src/consts';
import { Nft } from 'src/database/entities/Nft';

export const convertIpfsIntoReadable = (url: string, tokenAddress: string) => {
  if (!url) {
    return '';
  }
  if (tokenAddress.toLowerCase() === process.env.MEDIA_CONTRACT.toLowerCase()) {
    return url.replace('ipfs://', process.env.PINATA_GATE_WAY);
  } else {
    return url.startsWith('ipfs://')
      ? url.replace('ipfs://', 'https://ipfs.io/ipfs/')
      : url;
  }
};

export const buildPagination = (
  totalItems: number,
  page: number,
  size = PAGINATION,
) => {
  const totalPages = Math.ceil(totalItems / (size || PAGINATION));

  return {
    totalItems,
    totalPages,
    page,
    size,
  };
};

export const checkRevealDate = (nft: Nft) => {
  if (!nft) {
    return null;
  }

  if (nft.revealDate && nft.revealDate > Date.now().toString()) {
    delete nft.image;
    delete nft.tokenUri;
    delete nft.thumbnail;
  }
  return nft;
};

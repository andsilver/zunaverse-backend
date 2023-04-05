import { PAGINATION } from 'src/consts';

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

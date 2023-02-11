export const convertIpfsIntoReadable = (url: string, tokenAddress: string) => {
  if (tokenAddress.toLowerCase() === process.env.MEDIA_CONTRACT.toLowerCase()) {
    return url.replace('ipfs://', process.env.PINATA_GATE_WAY);
  } else {
    return url.startsWith('ipfs://')
      ? url.replace('ipfs://', 'https://ipfs.io/ipfs/')
      : url;
  }
};

import pinataSDK from '@pinata/sdk';
import Bottleneck from 'bottleneck';
import { createReadStream } from 'fs';
import { NftCategory } from '../types';

const limiter = new Bottleneck({
  minTime: 300,
  maxConcurrent: 1,
});

export const pinata = pinataSDK(
  process.env.PINATA_CLOUD_API_KEY,
  process.env.PINATA_CLOUD_API_SECRET,
);

export const pinImage = async (filePath: string) => {
  const readableStreamForFile = createReadStream(filePath);
  const res = await limiter.schedule(() =>
    pinata.pinFileToIPFS(readableStreamForFile),
  );
  return res.IpfsHash;
};

export const pinMetadata = async (
  name: string,
  description: string,
  category: NftCategory,
  image: string,
  properties: any,
) => {
  const metadata = {
    name,
    description,
    category,
    image,
    properties,
  };
  const metadataRes = await limiter.schedule(() =>
    pinata.pinJSONToIPFS(metadata),
  );
  return `ipfs://${metadataRes.IpfsHash}`;
};

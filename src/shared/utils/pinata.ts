import pinataSDK from '@pinata/sdk';

export const pinata = pinataSDK(
  process.env.PINATA_CLOUD_API_KEY,
  process.env.PINATA_CLOUD_API_SECRET,
);

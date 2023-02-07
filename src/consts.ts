export const BURN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
];
export const PAGINATION = 24;
export const ACTIVITY_EVENTS = {
  CREATE: 'CREATE',
  MINT: 'Mint',
  SALES: {
    SALE: 'Sale',
    PUT: 'Put on Sale',
    CANCEL: 'Removed from Sale',
    PRICE_SET: 'Set Price',
    PRICE_REMOVE: 'Price Removal',
  },
  BIDS: {
    NEW_BID: 'New Offer',
    CANCEL_BID: 'Bid Cancel',
  },
  LIKES: 'Liked',
  FOLLOWINGS: 'Following',
  TRANSFERS: 'Transfer',
};

export const CURRENCIES = {
  wbnb: {
    address: process.env.WBNB_ADDRESS,
    decimals: 18,
  },
  zuna: {
    address: process.env.ZUNA_ADDRESS,
    decimals: 9,
  },
};

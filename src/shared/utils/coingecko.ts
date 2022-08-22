import axios from 'axios';

export const fetchCoingeckoCoins = async (coinId: string) => {
  const {
    data: [coin],
  } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
    params: {
      vs_currency: 'usd',
      ids: `${coinId}`,
      sparkline: false,
    },
  });

  return coin;
};

export const fetchCoins = async () => {
  const {
    data: [wbnb, zuna],
  } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
    params: {
      vs_currency: 'usd',
      ids: `wbnb,zuna`,
      sparkline: false,
    },
  });

  return { wbnb, zuna };
};

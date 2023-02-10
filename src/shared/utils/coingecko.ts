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

export const fetchCoins = async (coinIds: string[]) => {
  const { data } = await axios.get(
    'https://api.coingecko.com/api/v3/coins/markets',
    {
      params: {
        vs_currency: 'usd',
        ids: coinIds.join(','),
        sparkline: false,
      },
    },
  );

  const result = {};

  coinIds.forEach((coinId) => {
    result[coinId] = data.find((i) => i.id === coinId);
  });

  return result;
};

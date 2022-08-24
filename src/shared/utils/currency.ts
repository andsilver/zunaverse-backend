import { CURRENCIES } from 'src/consts';
import Web3 from 'web3';

export const getCurrency = (symbol: string) => {
  return CURRENCIES[symbol.toLowerCase()];
};

export const currencySymbolToAddress = (symbol: string) => {
  return getCurrency(symbol).address;
};

export const currencyAddressToSymbol = (address: string) => {
  for (const symbol of Object.keys(CURRENCIES)) {
    const currency = CURRENCIES[symbol];
    console.log(currency);

    if (currency && currency.address.toLowerCase() === address.toLowerCase()) {
      return symbol;
    }
  }
  return null;
};

export const fromWei = (value, decimals) => {
  if (decimals === 18) {
    return Web3.utils.fromWei(value);
  } else if (decimals === 9) {
    return Web3.utils.fromWei(value, 'gwei');
  }
  const bn = Web3.utils.toBN(value);
  const ten = Web3.utils.toBN(10);
  return bn.div(ten.pow(Web3.utils.toBN(decimals))).toString();
};

export const toWei = (value, decimals) => {
  if (decimals === 18) {
    return Web3.utils.toWei(value);
  } else if (decimals === 9) {
    return Web3.utils.toWei(value, 'gwei');
  }
  const bn = Web3.utils.toBN(value);
  const ten = Web3.utils.toBN(10);
  return bn.mul(ten.pow(Web3.utils.toBN(decimals))).toString();
};

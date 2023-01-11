const Web3 = require('web3');
const Erc20Abi = require('./src/indexer/abis/Erc20.json');

const address = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const web3 = new Web3('https://bsc-dataseed.binance.org/');
const contract = new web3.eth.Contract(Erc20Abi, address);

const startBlock = 19993583;

async function check1(fromBlockNumber) {
  const chunkLimit = 4000;

  const toBlockNumber = await web3.eth.getBlockNumber();
  const totalBlocks = toBlockNumber - fromBlockNumber;

  const chunks = [];

  if (totalBlocks > chunkLimit) {
    const count = Math.ceil(totalBlocks / chunkLimit);
    let startingBlock = fromBlockNumber;

    for (let index = 0; index < count; index++) {
      const fromRangeBlock = startingBlock;
      const toRangeBlock =
        index === count - 1 ? toBlockNumber : startingBlock + chunkLimit;
      startingBlock = toRangeBlock + 1;

      chunks.push({ fromBlock: fromRangeBlock, toBlock: toRangeBlock });
    }
  } else {
    chunks.push({ fromBlock: fromBlockNumber, toBlock: toBlockNumber });
  }

  const logs = [];

  for (const chunk of chunks) {
    const chunkLogs = await contract.getPastEvents('Approval', {
      fromBlock: chunk.fromBlock,
      toBlock: chunk.toBlock,
    });
    logs.push(...chunkLogs);
  }

  for (const log of logs) {
    if (
      log.returnValues.spender.toLowerCase() ===
      '0x8882bd26611de2b9e2504415D3D2df87Fc12Fc01'.toLowerCase()
    ) {
      console.log(
        `${log.returnValues.owner}: ${Web3.utils.fromWei(
          await contract.methods
            .allowance(
              log.returnValues.owner,
              '0x8882bd26611de2b9e2504415D3D2df87Fc12Fc01',
            )
            .call(),
        )}\n`,
      );
    }
  }
  setTimeout(() => {
    check1(toBlockNumber);
  }, 10000);
}

check1(startBlock);

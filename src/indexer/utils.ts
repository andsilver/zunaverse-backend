export function getEventAbi(contractAbi: any, eventName: string) {
  const abi = contractAbi.find(
    (input) => input.name === eventName && input.type === 'event',
  );
  return abi;
}

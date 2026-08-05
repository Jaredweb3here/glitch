export const RPC_URL = process.env.GLITCH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
export const GLITCH_TOKEN = (process.env.GLITCH_TOKEN_ADDRESS || '0x68b966b34bc8781b86ecb06fc3f47d3584352dc1').toLowerCase();
export const REDIS_PREFIX = process.env.GLITCH_REDIS_PREFIX || `glitch:${GLITCH_TOKEN}`;
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function redisKey(name) {
  return `${REDIS_PREFIX}:${name}`;
}

export async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

export function hexToBigInt(hex) {
  return BigInt(hex || '0x0');
}

export function weiToEth(wei) {
  return Number(wei) / 1e18;
}

export function normalizeAddress(address) {
  return String(address || '').toLowerCase();
}

export function addressFromTopic(topic) {
  if (typeof topic !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(topic)) return '';
  return `0x${topic.slice(26)}`.toLowerCase();
}

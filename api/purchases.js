import { redisCommand } from './_lib/redis.js';
import { GLITCH_TOKEN, TRANSFER_TOPIC, addressFromTopic, hexToBigInt, normalizeAddress, redisKey, rpc, weiToEth } from './_lib/chain.js';

const MAX_BODY_BYTES = 4096;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 30;
const MIN_CONFIRMATIONS = 2;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function getCurrentBlockNumber() {
  return Number(hexToBigInt(await rpc('eth_blockNumber', [])));
}

function getBuyerTransfer(logs, buyer) {
  const normalizedBuyer = normalizeAddress(buyer);
  return logs.find(log => {
    if (normalizeAddress(log.address) !== GLITCH_TOKEN) return false;
    if (normalizeAddress(log.topics?.[0]) !== TRANSFER_TOPIC) return false;
    if (addressFromTopic(log.topics?.[2]) !== normalizedBuyer) return false;
    return hexToBigInt(log.data) > 0n;
  });
}

async function verifyPurchase(txHash) {
  const tx = await rpc('eth_getTransactionByHash', [txHash]);
  if (!tx) throw new Error('Transaction not found');

  const valueWei = hexToBigInt(tx.value);
  if (valueWei <= 0n) throw new Error('Transaction has no native ETH value');

  const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
  if (!receipt || receipt.status !== '0x1') throw new Error('Transaction is not successful');

  const currentBlock = await getCurrentBlockNumber();
  const receiptBlock = Number(hexToBigInt(receipt.blockNumber));
  if (currentBlock - receiptBlock < MIN_CONFIRMATIONS) {
    throw new Error('Transaction does not have enough confirmations');
  }

  const buyerTransfer = getBuyerTransfer(receipt.logs || [], tx.from);
  if (!buyerTransfer) throw new Error('Transaction does not transfer configured token to buyer');

  const block = await rpc('eth_getBlockByNumber', [tx.blockNumber, false]);
  const timestamp = block?.timestamp ? Number(hexToBigInt(block.timestamp)) * 1000 : Date.now();

  return {
    txHash,
    address: tx.from,
    ethAmount: weiToEth(valueWei),
    tokenAmountRaw: hexToBigInt(buyerTransfer.data).toString(),
    timestamp,
    token: GLITCH_TOKEN
  };
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Payload too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function enforceRateLimit(req) {
  const ip = getClientIp(req).replace(/[^a-zA-Z0-9:.:-]/g, '_').slice(0, 96);
  const key = redisKey(`rate:purchases:${ip}`);
  const count = await redisCommand(['INCR', key]);
  if (Number(count.result) === 1) {
    await redisCommand(['EXPIRE', key, String(RATE_LIMIT_WINDOW_SECONDS)]);
  }
  if (Number(count.result) > RATE_LIMIT_MAX) {
    const error = new Error('Too many requests');
    error.statusCode = 429;
    throw error;
  }
}

function safeParsePurchase(item) {
  try {
    return JSON.parse(item);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const list = await redisCommand(['LRANGE', redisKey('purchases'), '0', '49']);
      const records = Array.isArray(list.result) ? list.result : (list.result ? [list.result] : []);
      const purchases = records.map(safeParsePurchase).filter(Boolean);
      return json(res, 200, { purchases });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { error: 'Method not allowed' });
    }

    if (req.headers?.['content-type'] && !String(req.headers['content-type']).includes('application/json')) {
      return json(res, 415, { error: 'Unsupported media type' });
    }

    await enforceRateLimit(req);

    const body = await readBody(req);
    const txHash = String(body.txHash || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return json(res, 400, { error: 'Invalid transaction hash' });
    }

    const lock = await redisCommand(['SET', redisKey(`purchase-lock:${txHash}`), '1', 'NX', 'EX', '90']);
    if (lock.result !== 'OK') {
      return json(res, 200, { ok: true, duplicate: true });
    }

    const purchase = await verifyPurchase(txHash);
    const dedupe = await redisCommand(['SET', redisKey(`purchase:${txHash}`), '1', 'NX', 'EX', '2592000']);
    if (dedupe.result !== 'OK') {
      return json(res, 200, { ok: true, duplicate: true });
    }

    await redisCommand(['LPUSH', redisKey('purchases'), JSON.stringify(purchase)]);
    await redisCommand(['LTRIM', redisKey('purchases'), '0', '499']);

    return json(res, 200, { ok: true, purchase });
  } catch (error) {
    const status = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error(error);
    return json(res, status, { error: status >= 500 ? 'Internal server error' : error.message });
  }
}

import { redisCommand } from '../api/_lib/redis.js';
import { GLITCH_TOKEN, REDIS_PREFIX, TRANSFER_TOPIC, addressFromTopic, hexToBigInt, redisKey, rpc, weiToEth } from '../api/_lib/chain.js';
import { getGmgnTokenInfo } from '../api/_lib/gmgn.js';

const ETH_PRICE = 1800;
const SCAN_BLOCKS = Number(process.env.GLITCH_SCAN_BLOCKS || 5000);
const BLOCKSCOUT_URL = process.env.GLITCH_BLOCKSCOUT_URL || 'https://robinhoodchain.blockscout.com';
const POLL_INTERVAL_MS = 1500;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

let tokenInfoCache = null;
let tokenInfoCacheAt = 0;
let running = false;

function log(msg) {
  console.log(`[indexer] ${new Date().toISOString()} ${msg}`);
}

function safeParse(item) {
  try { return JSON.parse(item); } catch { return null; }
}

function formatTokenAmount(raw, decimals) {
  if (typeof raw === 'number') return raw;
  const value = Number(raw) / (10 ** decimals);
  return Number.isFinite(value) ? value : 0;
}

function parseIsoTimestamp(value) {
  const ts = Date.parse(value || '');
  return Number.isFinite(ts) ? ts : Date.now();
}

function hexBlock(n) {
  return `0x${n.toString(16)}`;
}

function decodeAbiString(result) {
  if (!result || result === '0x') return '';
  const hex = result.slice(2);
  try {
    if (hex.length === 64) return Buffer.from(hex.replace(/00+$/, ''), 'hex').toString('utf8').trim();
    const length = Number(BigInt(`0x${hex.slice(64, 128) || '0'}`));
    return Buffer.from(hex.slice(128, 128 + length * 2), 'hex').toString('utf8').trim();
  } catch { return ''; }
}

async function ethCall(data) {
  return rpc('eth_call', [{ to: GLITCH_TOKEN, data }, 'latest']);
}

async function getTokenInfo() {
  if (tokenInfoCache && Date.now() - tokenInfoCacheAt < 60_000) return tokenInfoCache;

  try {
    const gmgn = await getGmgnTokenInfo(GLITCH_TOKEN);
    if (gmgn) {
      tokenInfoCache = gmgn;
      tokenInfoCacheAt = Date.now();
      await redisCommand(['SET', redisKey('token-info'), JSON.stringify(gmgn), 'EX', '120']);
      return tokenInfoCache;
    }
  } catch (err) {
    log(`GMGN error: ${err.message}`);
  }

  try {
    const [name, symbol, decimalsRaw, supplyRaw] = await Promise.allSettled([
      ethCall('0x06fdde03'), ethCall('0x95d89b41'),
      ethCall('0x313ce567'), ethCall('0x18160ddd')
    ]);
    const decimals = decimalsRaw.status === 'fulfilled' ? Number(hexToBigInt(decimalsRaw.value)) : 18;
    tokenInfoCache = {
      address: GLITCH_TOKEN,
      name: name.status === 'fulfilled' ? decodeAbiString(name.value) : '',
      symbol: symbol.status === 'fulfilled' ? decodeAbiString(symbol.value) : '',
      decimals: Number.isFinite(decimals) ? decimals : 18,
      totalSupplyRaw: supplyRaw.status === 'fulfilled' ? hexToBigInt(supplyRaw.value).toString() : '0'
    };
    tokenInfoCacheAt = Date.now();
    await redisCommand(['SET', redisKey('token-info'), JSON.stringify(tokenInfoCache), 'EX', '120']);
  } catch (err) {
    log(`RPC token info error: ${err.message}`);
  }

  return tokenInfoCache;
}

async function blockscoutGet(path) {
  try {
    const res = await fetch(`${BLOCKSCOUT_URL}${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'glitch-indexer/1.0' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function classifyTransfer(log, tx) {
  const from = addressFromTopic(log.topics?.[1]);
  const to = addressFromTopic(log.topics?.[2]);
  const sender = String(tx.from || '').toLowerCase();
  const valueWei = hexToBigInt(tx.value);
  if (to === sender && valueWei > 0n) return { type: 'Buy', wallet: to };
  if (from === sender && to !== ZERO_ADDRESS) return { type: 'Sell', wallet: from };
  return { type: 'Transfer', wallet: to || from || sender };
}

async function storeRpcEvent(log, tokenInfo, blockTimestamps) {
  const txHash = log.transactionHash;
  const eventId = `${txHash}:${Number(hexToBigInt(log.logIndex || '0x0'))}`;

  const tx = await rpc('eth_getTransactionByHash', [txHash]);
  if (!tx) return;

  const valueWei = hexToBigInt(tx.value);
  const tokenAmountRaw = hexToBigInt(log.data);
  if (tokenAmountRaw <= 0n) return;

  const dedup = await redisCommand(['SET', redisKey(`event:${eventId}`), '1', 'NX', 'EX', '2592000']);
  if (dedup.result !== 'OK') return;

  const timestamp = blockTimestamps.get(log.blockNumber) || Date.now();
  const cls = classifyTransfer(log, tx);
  const tokenAmount = formatTokenAmount(tokenAmountRaw.toString(), tokenInfo.decimals);
  const ethAmount = weiToEth(valueWei);
  const usd = cls.type === 'Buy' ? Number((ethAmount * ETH_PRICE).toFixed(2)) : 0;
  const tokenPriceUsd = tokenInfo.priceUsd || (cls.type === 'Buy' && tokenAmount > 0 ? usd / tokenAmount : 0);
  const totalSupply = tokenInfo.totalSupply || formatTokenAmount(tokenInfo.totalSupplyRaw, tokenInfo.decimals);
  const mcUsd = tokenInfo.marketCapUsd || (tokenPriceUsd > 0 ? tokenPriceUsd * totalSupply : 0);

  await redisCommand(['LPUSH', redisKey('tape'), JSON.stringify({
    id: eventId, txHash, type: cls.type, wallet: cls.wallet,
    ethAmount, usd, mcUsd, tokenAmount,
    tokenAmountRaw: tokenAmountRaw.toString(), timestamp, token: GLITCH_TOKEN, source: 'rpc'
  })]);
  await redisCommand(['LTRIM', redisKey('tape'), '0', '499']);

  if (cls.type === 'Buy' && valueWei > 0n) {
    const dup = await redisCommand(['SET', redisKey(`purchase:${txHash}`), '1', 'NX', 'EX', '2592000']);
    if (dup.result === 'OK') {
      await redisCommand(['LPUSH', redisKey('purchases'), JSON.stringify({
        txHash, address: cls.wallet, ethAmount,
        tokenAmountRaw: tokenAmountRaw.toString(), timestamp, token: GLITCH_TOKEN
      })]);
      await redisCommand(['LTRIM', redisKey('purchases'), '0', '499']);
    }
  }
}

async function indexRpc(tokenInfo) {
  const currentBlock = Number(hexToBigInt(await rpc('eth_blockNumber', [])));
  const cursorRaw = await redisCommand(['GET', redisKey('scan-cursor')]);
  const cursor = cursorRaw.result ? Number(cursorRaw.result) : Math.max(0, currentBlock - SCAN_BLOCKS);
  const fromBlock = Math.max(0, Math.min(cursor + 1, currentBlock));
  if (fromBlock > currentBlock) return;

  const logs = await rpc('eth_getLogs', [{
    address: GLITCH_TOKEN,
    fromBlock: hexBlock(fromBlock),
    toBlock: hexBlock(currentBlock),
    topics: [TRANSFER_TOPIC]
  }]);

  const recent = (Array.isArray(logs) ? logs : []).slice(-80).filter(l => hexToBigInt(l.data) > 0n);
  const blockNums = [...new Set(recent.map(l => l.blockNumber))];
  const blockEntries = await Promise.all(blockNums.map(async bn => {
    const b = await rpc('eth_getBlockByNumber', [bn, false]);
    return [bn, b?.timestamp ? Number(hexToBigInt(b.timestamp)) * 1000 : Date.now()];
  }));
  const blockTimestamps = new Map(blockEntries);

  await Promise.all(recent.map(l => storeRpcEvent(l, tokenInfo, blockTimestamps)));
  await redisCommand(['SET', redisKey('scan-cursor'), String(currentBlock), 'EX', '2592000']);
}

async function storeBlockscoutTransfer(transfer, tokenInfo) {
  const txHash = transfer.transaction_hash;
  if (!txHash) return;

  const tokenAmountRaw = transfer.total?.value || '0';
  const tokenAmount = formatTokenAmount(tokenAmountRaw, tokenInfo.decimals);
  if (tokenAmount <= 0) return;

  const eventId = `${txHash}:blockscout`;
  const dedup = await redisCommand(['SET', redisKey(`event:${eventId}`), '1', 'NX', 'EX', '2592000']);
  if (dedup.result !== 'OK') return;

  const tx = await blockscoutGet(`/api/v2/transactions/${txHash}`);
  if (!tx || tx.status !== 'ok') {
    await redisCommand(['DEL', redisKey(`event:${eventId}`)]);
    return;
  }

  const nativeValue = Number(tx.value || 0) / 1e18;
  const exchangeRate = Number(tx.exchange_rate || ETH_PRICE);
  const isBuy = nativeValue > 0;
  const type = isBuy ? 'Buy' : 'Sell';
  const usd = isBuy ? nativeValue * exchangeRate : tokenAmount * (tokenInfo.priceUsd || 0);
  const wallet = String(tx.from?.hash || transfer.to?.hash || transfer.from?.hash || '').toLowerCase();

  await redisCommand(['LPUSH', redisKey('tape'), JSON.stringify({
    id: eventId, txHash, type, wallet,
    blockNumber: transfer.block_number || null,
    logIndex: transfer.log_index ?? '0',
    ethAmount: nativeValue,
    usd: Number(usd.toFixed(2)),
    mcUsd: tokenInfo.marketCapUsd || 0,
    tokenAmount, tokenAmountRaw,
    timestamp: parseIsoTimestamp(tx.timestamp || transfer.timestamp),
    token: GLITCH_TOKEN, source: 'blockscout'
  })]);
  await redisCommand(['LTRIM', redisKey('tape'), '0', '499']);
}

async function indexBlockscout(tokenInfo) {
  const data = await blockscoutGet(`/api/v2/tokens/${GLITCH_TOKEN}/transfers`);
  const items = Array.isArray(data?.items) ? data.items : [];
  const byTx = new Map();
  for (const item of items) {
    if (String(item.token?.address_hash || '').toLowerCase() !== GLITCH_TOKEN) continue;
    const txHash = item.transaction_hash;
    if (!txHash) continue;
    const cur = byTx.get(txHash);
    if (!cur || Number(item.total?.value || 0) > Number(cur.total?.value || 0)) byTx.set(txHash, item);
  }
  await Promise.all([...byTx.values()].slice(0, 20).map(item => storeBlockscoutTransfer(item, tokenInfo)));
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const tokenInfo = await getTokenInfo();
    if (!tokenInfo) return;
    const results = await Promise.allSettled([
      indexBlockscout(tokenInfo),
      indexRpc(tokenInfo)
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        log(`index error: ${result.reason?.message || result.reason}`);
      }
    }
  } catch (err) {
    log(`tick error: ${err.message}`);
  } finally {
    running = false;
  }
}

log(`starting — token ${GLITCH_TOKEN}, prefix ${REDIS_PREFIX}`);
tick();
setInterval(tick, POLL_INTERVAL_MS);

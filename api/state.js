import { redisCommand } from './_lib/redis.js';
import { GLITCH_TOKEN, redisKey } from './_lib/chain.js';

const ETH_PRICE = 1800;
const ROUND_SECONDS = 60;
const MIN_ENTRY_USD = 2;
const POT_FEE_RATE = 0.01;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function safeParse(item) {
  try { return JSON.parse(item); } catch { return null; }
}

function eventToTrade(event) {
  const eth = Number(event.ethAmount || 0);
  return {
    id: event.id || event.txHash,
    txHash: event.txHash,
    type: event.type || 'Buy',
    wallet: event.wallet || event.address,
    usd: Number(event.usd || (eth * ETH_PRICE).toFixed(2)),
    mcUsd: Number(event.mcUsd || 0),
    tokenAmount: Number(event.tokenAmount || 0),
    eth,
    timestamp: Number(event.timestamp || Date.now()),
    source: event.source || 'rpc'
  };
}

function buildState(events, tokenInfo) {
  const seenTrades = new Map();
  for (const trade of events
    .map(eventToTrade)
    .filter(t => t.id && t.wallet && Number.isFinite(t.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)) {
    const key = trade.txHash ? `${trade.txHash}:${trade.type}` : trade.id;
    const existing = seenTrades.get(key);
    if (!existing || (existing.source !== 'blockscout' && trade.source === 'blockscout')) {
      seenTrades.set(key, trade);
    }
  }

  const allTrades = [...seenTrades.values()].slice(0, 500);
  const latestBuy = allTrades.find(t => t.type === 'Buy' && t.usd > 0 && Number(t.tokenAmount) > 0);
  const latestTokenPriceUsd = latestBuy ? latestBuy.usd / Number(latestBuy.tokenAmount) : 0;
  const latestMcUsd = tokenInfo?.marketCapUsd || latestBuy?.mcUsd || 0;

  const trades = allTrades
    .filter(t => t.type === 'Buy' || t.type === 'Sell')
    .map(t => {
      if (t.type !== 'Sell' || t.usd > 0 || latestTokenPriceUsd <= 0) return t;
      return { ...t, usd: Number((Number(t.tokenAmount || 0) * latestTokenPriceUsd).toFixed(2)), mcUsd: latestMcUsd };
    });

  const buyTrades = trades.filter(t => t.type === 'Buy' && t.usd >= MIN_ENTRY_USD);

  const buyersMap = new Map();
  for (const t of buyTrades) {
    const key = t.wallet.toLowerCase();
    const cur = buyersMap.get(key) || { wallet: t.wallet, buys: 0, inUsd: 0 };
    cur.buys += 1;
    cur.inUsd += t.usd;
    buyersMap.set(key, cur);
  }

  const buyers = [...buyersMap.values()].sort((a, b) => b.inUsd - a.inUsd);
  const volumeUsd = buyTrades.reduce((s, t) => s + t.usd, 0);
  const potUsd = buyTrades.reduce((s, t) => s + t.usd * POT_FEE_RATE, 0);
  const latest = buyTrades[0];
  const elapsed = latest ? Math.max(0, Math.floor((Date.now() - latest.timestamp) / 1000)) : 0;
  const secondsLeft = latest ? Math.max(1, ROUND_SECONDS - (elapsed % ROUND_SECONDS)) : ROUND_SECONDS;

  return {
    round: {
      roundId: 1,
      secondsLeft,
      minEntryUsd: MIN_ENTRY_USD,
      potEth: potUsd / ETH_PRICE,
      potUsd,
      roundVolumeUsd: volumeUsd,
      wallets: buyers.length,
      buys: buyTrades.length,
      lastBuyer: latest?.wallet || '0x0000000000000000000000000000000000000000',
      status: 'active'
    },
    trades: trades.slice(0, 50),
    buyers: buyers.slice(0, 50),
    payouts: [],
    generatedAt: Date.now(),
    token: GLITCH_TOKEN,
    tokenInfo: tokenInfo ? { ...tokenInfo, latestMcUsd } : null
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { error: 'Method not allowed' });
    }

    const [tapeResult, tokenInfoResult] = await Promise.all([
      redisCommand(['LRANGE', redisKey('tape'), '0', '499']),
      redisCommand(['GET', redisKey('token-info')])
    ]);

    const records = Array.isArray(tapeResult.result)
      ? tapeResult.result
      : (tapeResult.result ? [tapeResult.result] : []);
    const events = records.map(safeParse).filter(Boolean);
    const tokenInfo = safeParse(tokenInfoResult.result);

    return json(res, 200, buildState(events, tokenInfo));
  } catch (error) {
    console.error('[state]', error);
    return json(res, 500, { error: 'Internal server error' });
  }
}

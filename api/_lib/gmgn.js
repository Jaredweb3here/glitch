import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOST = 'https://openapi.gmgn.ai';

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const output = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    output[key] = value;
  }
  return output;
}

function getApiKey() {
  if (process.env.GMGN_API_KEY) return process.env.GMGN_API_KEY;
  const env = parseEnvFile(join(homedir(), '.config', 'gmgn', '.env'));
  return env.GMGN_API_KEY || '';
}

async function gmgnGet(path, params) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`${HOST}${path}`);
  for (const [key, value] of Object.entries({
    ...params,
    timestamp: Math.floor(Date.now() / 1000),
    client_id: randomUUID()
  })) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      'X-APIKEY': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'glitch-local-live/1.0'
    }
  });
  if (!response.ok) return null;
  return response.json();
}

export async function getGmgnTokenInfo(address) {
  const payload = await gmgnGet('/v1/token/info', { chain: 'robinhood', address });
  if (!payload) return null;
  const data = payload.data || payload;

  const priceUsd = Number(data.price?.price || data.price || 0);
  const supply = Number(data.circulating_supply || data.total_supply || 0);
  return {
    address: data.address || address,
    name: data.name || '',
    symbol: data.symbol || '',
    decimals: Number(data.decimals || 18),
    totalSupply: supply,
    totalSupplyRaw: data.total_supply || '0',
    priceUsd,
    marketCapUsd: priceUsd > 0 && supply > 0 ? priceUsd * supply : Number(data.dev?.ath_token_info?.ath_mc || 0),
    liquidityUsd: Number(data.liquidity || data.pool?.liquidity || 0),
    holderCount: Number(data.holder_count || data.stat?.holder_count || 0),
    buys1m: Number(data.price?.buys_1m || 0),
    sells1m: Number(data.price?.sells_1m || 0),
    volume1mUsd: Number(data.price?.volume_1m || 0),
    gmgnUrl: data.link?.gmgn || ''
  };
}

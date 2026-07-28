import { redisCommand } from './_lib/redis.js';
import { GLITCH_TOKEN, REDIS_PREFIX, redisKey } from './_lib/chain.js';

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function probe(command) {
  try {
    const result = await redisCommand(command);
    return { ok: true, result: result.result ?? null };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const [tape, purchases, tokenInfo, scanCursor] = await Promise.all([
    probe(['LLEN', redisKey('tape')]),
    probe(['LLEN', redisKey('purchases')]),
    probe(['GET', redisKey('token-info')]),
    probe(['GET', redisKey('scan-cursor')])
  ]);

  return json(res, 200, {
    prefix: REDIS_PREFIX,
    token: GLITCH_TOKEN,
    tapeLen: tape.ok ? tape.result : null,
    purchasesLen: purchases.ok ? purchases.result : null,
    hasTokenInfo: tokenInfo.ok ? Boolean(tokenInfo.result) : null,
    scanCursor: scanCursor.ok ? scanCursor.result : null,
    errors: [tape, purchases, tokenInfo, scanCursor].filter(p => !p.ok).map(p => p.error),
    now: Date.now()
  });
}

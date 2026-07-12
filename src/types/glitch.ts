export type Trade = {
  id: string;
  time: string;
  type?: 'Buy' | 'Sell' | 'Transfer';
  wallet: string;
  usd: number;
  eth: number;
  mcUsd?: number;
  tokenAmount?: number;
  buysInRound: number;
  timestamp?: number;
};

export type TokenInfo = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupplyRaw: string;
  latestMcUsd: number;
  priceUsd?: number;
  liquidityUsd?: number;
  holderCount?: number;
  buys1m?: number;
  sells1m?: number;
  volume1mUsd?: number;
  gmgnUrl?: string;
};

export type BuyerStat = {
  wallet: string;
  buys: number;
  inUsd: number;
};

export type Payout = {
  roundId: number;
  winner: string;
  eth: number;
  usd: number;
  timestamp: number;
};

export type RoundState = {
  roundId: number;
  secondsLeft: number;
  minEntryUsd: number;
  potEth: number;
  potUsd: number;
  roundVolumeUsd: number;
  wallets: number;
  buys: number;
  lastBuyer: string;
  status: 'active' | 'payout' | 'restarting';
};

export type TradeParticle = {
  id: string;
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

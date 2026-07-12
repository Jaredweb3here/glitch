import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BuyerStat, Payout, RoundState, TokenInfo, Trade } from '../types/glitch';

const ETH_PRICE = 1800;
const POT_FEE_RATE = 0.02 * 0.5;
const wallets = [
  '0x3A11F8d920aC4E0E2B11A973e4E7C836F2A26048',
  '0x9250E4f7839dA7461a7d9A59B617Dcb452e91c7c',
  '0x3cAA2BA47860Fca1238A92E5B9F974348427B8F5',
  '0x5E38a53b326A8e92bf749A3f20466f8F02Fd3fEA',
  '0x9b04a4032923855e1d06d7080525d6fe61bb0558',
  '0xc80ab89C3e2259e1D642f6D2F3cFe63655B0145B'
];

const initialTrades: Trade[] = [
  { id: 'seed-1', time: '1m ago', wallet: wallets[0], usd: 9, eth: 0.005, buysInRound: 4 },
  { id: 'seed-2', time: '1m ago', wallet: wallets[1], usd: 32.4, eth: 0.018, buysInRound: 3 },
  { id: 'seed-3', time: '1m ago', wallet: wallets[2], usd: 18, eth: 0.01, buysInRound: 2 },
  { id: 'seed-4', time: '8m ago', wallet: wallets[3], usd: 4.32, eth: 0.0024, buysInRound: 1 }
];

const initialRound: RoundState = {
  roundId: 1,
  secondsLeft: 38,
  minEntryUsd: 2,
  potEth: 12.4507,
  potUsd: 22411.26,
  roundVolumeUsd: 32594,
  wallets: 121,
  buys: 290,
  lastBuyer: '0x9b04a4032923855e1d06d7080525d6fe61bb0558',
  status: 'active'
};

function shortTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function randomWallet() {
  return wallets[Math.floor(Math.random() * wallets.length)];
}

function makeTrade(usd?: number): Trade {
  const amount = usd ?? Number((2 + Math.random() * 118).toFixed(2));
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: 'just now',
    wallet: randomWallet(),
    usd: amount,
    eth: Number((amount / ETH_PRICE).toFixed(4)),
    buysInRound: 1,
    timestamp: Date.now()
  };
}

type StoredPurchase = {
  txHash: string;
  address: string;
  ethAmount: number;
  timestamp: number;
};

type LiveTrade = Omit<Trade, 'time' | 'buysInRound'> & {
  txHash?: string;
};

type LiveState = {
  round?: RoundState;
  trades?: LiveTrade[];
  buyers?: BuyerStat[];
  payouts?: Payout[];
  tokenInfo?: TokenInfo;
};

const mode: 'demo' | 'live' = import.meta.env.VITE_GLITCH_MODE === 'demo' ? 'demo' : 'live';

function purchaseToTrade(purchase: StoredPurchase): Trade {
  return {
    id: purchase.txHash,
    time: shortTime(purchase.timestamp),
    wallet: purchase.address,
    usd: Number((purchase.ethAmount * ETH_PRICE).toFixed(2)),
    eth: purchase.ethAmount,
    buysInRound: 1,
    timestamp: purchase.timestamp
  };
}

function roundFromTrades(trades: Trade[]): RoundState {
  const volume = trades.reduce((sum, trade) => sum + trade.usd, 0);
  const uniqueWallets = new Set(trades.map(trade => trade.wallet.toLowerCase()));
  const potUsd = trades.reduce((sum, trade) => sum + trade.usd * POT_FEE_RATE, 0);
  const latest = trades[0];
  const latestTimestamp = latest?.timestamp ?? Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - latestTimestamp) / 1000));
  return {
    roundId: 1,
    secondsLeft: latest ? Math.max(1, 60 - (elapsed % 60)) : 60,
    minEntryUsd: 2,
    potEth: potUsd / ETH_PRICE,
    potUsd,
    roundVolumeUsd: volume,
    wallets: uniqueWallets.size,
    buys: trades.length,
    lastBuyer: latest?.wallet ?? '0x0000000000000000000000000000000000000000',
    status: 'active'
  };
}

export function useRoundEngine(onValidTrade?: (trade: Trade) => void) {
  const [round, setRound] = useState<RoundState>(mode === 'demo' ? initialRound : roundFromTrades([]));
  const [trades, setTrades] = useState<Trade[]>(mode === 'demo' ? initialTrades : []);
  const [serverBuyers, setServerBuyers] = useState<BuyerStat[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | undefined>();
  const [lastTradeId, setLastTradeId] = useState(mode === 'demo' ? initialTrades[0].id : '');
  const tradeTimes = useRef<Record<string, number>>({});
  const liveLoadInFlight = useRef(false);
  const payoutRef = useRef(false);

  const computedBuyers = useMemo<BuyerStat[]>(() => {
    const map = new Map<string, BuyerStat>();
    trades.forEach(trade => {
      const existing = map.get(trade.wallet) ?? { wallet: trade.wallet, buys: 0, inUsd: 0 };
      existing.buys += 1;
      existing.inUsd += trade.usd;
      map.set(trade.wallet, existing);
    });
    return [...map.values()].sort((a, b) => b.inUsd - a.inUsd);
  }, [trades]);

  const buyers = mode === 'demo' ? computedBuyers : serverBuyers;

  const applyTrade = useCallback((trade: Trade) => {
    tradeTimes.current[trade.id] = Date.now();
    setTrades(current => [{ ...trade, time: 'just now' }, ...current].slice(0, 30));
    setLastTradeId(trade.id);

    setRound(current => {
      const valid = trade.usd >= current.minEntryUsd && current.status === 'active';
      const feeToPot = trade.usd * POT_FEE_RATE;
      return {
        ...current,
        secondsLeft: valid ? 60 : current.secondsLeft,
        potUsd: current.potUsd + feeToPot,
        potEth: current.potEth + feeToPot / ETH_PRICE,
        roundVolumeUsd: current.roundVolumeUsd + trade.usd,
        wallets: current.wallets + (Math.random() > 0.64 ? 1 : 0),
        buys: current.buys + 1,
        lastBuyer: valid ? trade.wallet : current.lastBuyer
      };
    });

    onValidTrade?.(trade);
  }, [onValidTrade]);

  const settleRound = useCallback(() => {
    if (payoutRef.current) return;
    payoutRef.current = true;
    setRound(current => ({ ...current, secondsLeft: 0, status: 'payout' }));

    window.setTimeout(() => {
      setRound(current => {
        setPayouts(history => [{
          roundId: current.roundId,
          winner: current.lastBuyer,
          eth: current.potEth,
          usd: current.potUsd,
          timestamp: Date.now()
        }, ...history].slice(0, 4));
        return { ...current, status: 'restarting' };
      });
    }, 1800);

    window.setTimeout(() => {
      payoutRef.current = false;
      setTrades([]);
      setRound(current => ({
        roundId: current.roundId + 1,
        secondsLeft: 60,
        minEntryUsd: 2,
        potEth: 0,
        potUsd: 0,
        roundVolumeUsd: 0,
        wallets: 0,
        buys: 0,
        lastBuyer: '0x0000000000000000000000000000000000000000',
        status: 'active'
      }));
    }, 4800);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRound(current => {
        if (current.status !== 'active') return current;
        if (current.secondsLeft <= 1) {
          if (mode === 'demo') window.setTimeout(settleRound, 0);
          return { ...current, secondsLeft: mode === 'demo' ? 0 : 60 };
        }
        return { ...current, secondsLeft: current.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settleRound]);

  useEffect(() => {
    if (mode !== 'live') return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/purchases');
        if (!response.ok) return;
        const data = await response.json();
        const purchases = Array.isArray(data.purchases) ? data.purchases : [];
        const loaded = purchases
          .filter((purchase: Partial<StoredPurchase>) => purchase.txHash && purchase.address && typeof purchase.ethAmount === 'number')
          .map((purchase: StoredPurchase) => purchaseToTrade(purchase));
        if (cancelled) return;
        setTrades(loaded);
        setLastTradeId(loaded[0]?.id ?? '');
        setRound(roundFromTrades(loaded));
      } catch {
        // Keep live dashboard empty if API is unavailable.
      }
    };

    const loadState = async () => {
      if (liveLoadInFlight.current) return;
      liveLoadInFlight.current = true;
      try {
        const response = await fetch('/api/state');
        if (!response.ok) return;
        const data: LiveState = await response.json();
        const loaded = Array.isArray(data.trades)
          ? data.trades.map(trade => ({
            ...trade,
            time: shortTime(trade.timestamp ?? Date.now()),
            buysInRound: 1
          }))
          : [];
        if (cancelled) return;
        setTrades(loaded);
        setServerBuyers(Array.isArray(data.buyers) ? data.buyers : []);
        setPayouts(Array.isArray(data.payouts) ? data.payouts : []);
        setTokenInfo(data.tokenInfo);
        setLastTradeId(loaded[0]?.id ?? '');
        const incomingRound = data.round ?? roundFromTrades(loaded);
        setRound(current => {
          const hasNewBuy = incomingRound.buys > current.buys || incomingRound.lastBuyer !== current.lastBuyer;
          const statusChanged = incomingRound.status !== current.status || incomingRound.roundId !== current.roundId;
          const firstLiveLoad = current.buys === 0 && current.wallets === 0;
          const secondsLeft = firstLiveLoad || hasNewBuy || statusChanged
            ? incomingRound.secondsLeft
            : Math.min(current.secondsLeft, incomingRound.secondsLeft);
          return { ...incomingRound, secondsLeft };
        });
      } catch {
        await load();
      } finally {
        liveLoadInFlight.current = false;
      }
    };

    loadState();
    const interval = window.setInterval(loadState, 750);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'demo') return;
    let cancelled = false;
    let timeout = 0;
    const loop = () => {
      timeout = window.setTimeout(() => {
        if (!cancelled) {
          applyTrade(makeTrade());
          loop();
        }
      }, 800 + Math.random() * 1800);
    };
    loop();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [applyTrade]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTrades(current => current.map(trade => ({
        ...trade,
        time: trade.timestamp ? shortTime(trade.timestamp) : (tradeTimes.current[trade.id] ? shortTime(tradeTimes.current[trade.id]) : trade.time)
      })));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const simulateBuy = useCallback(() => {
    if (mode !== 'demo') return;
    applyTrade(makeTrade());
  }, [applyTrade]);

  return { round, trades, buyers, payouts, lastTradeId, simulateBuy, mode, tokenInfo };
}

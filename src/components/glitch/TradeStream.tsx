import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Trade } from '../../types/glitch';

type Props = {
  trades: Trade[];
  lastTradeId: string;
  potRef: RefObject<HTMLDivElement>;
  onParticleRequest: (source: DOMRect, destination: DOMRect, usd: number) => void;
};

export function TradeStream({ trades, lastTradeId, potRef, onParticleRequest }: Props) {
  const latestRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!latestRef.current || !potRef.current) return;
    onParticleRequest(latestRef.current.getBoundingClientRect(), potRef.current.getBoundingClientRect(), trades[0]?.usd ?? 0);
  }, [lastTradeId, onParticleRequest, potRef, trades]);

  const formatUsd = (value: number) => value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : `$${value.toFixed(value > 10 ? 0 : 3)}`;
  const formatAmount = (value = 0) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(value >= 10 ? 0 : 2);
  };

  return (
    <section className="panel trade-panel">
      <header className="panel-header">
        <div><h2>TRADE STREAM</h2><p>LIVE TAPE · LAST 8</p></div>
        <button className="panel-toggle">[-]</button>
      </header>
      <div className="stream-head"><span>AGE</span><span>TYPE</span><span>MC</span><span>AMOUNT</span><span>TOTAL USD</span><span>TRADER</span></div>
      <div className="stream-table">
        {trades.slice(0, 8).map(trade => (
          <motion.div
            className={`stream-row ${trade.id === lastTradeId ? 'is-new' : ''}`}
            key={trade.id}
            ref={trade.id === lastTradeId ? latestRef : undefined}
            initial={trade.id === lastTradeId ? { y: -12, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.24 }}
          >
            <span>{trade.time}</span>
            <b className={`trade-type type-${(trade.type || 'Buy').toLowerCase()}`}>{trade.type || 'Buy'}</b>
            <span>{trade.mcUsd ? formatUsd(trade.mcUsd) : '...'}</span>
            <span>{formatAmount(trade.tokenAmount)}</span>
            <strong>{trade.usd > 0 ? formatUsd(trade.usd) : '...'}</strong>
            <b>{trade.wallet.slice(0, 6)}...{trade.wallet.slice(-4)}</b>
          </motion.div>
        ))}
      </div>
      <footer className="stream-footer">TAIL · TRADES.LOG ■</footer>
      <div className="stream-search-icon"><Search size={13} /></div>
    </section>
  );
}

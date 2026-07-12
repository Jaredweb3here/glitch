import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BuyerStat, RoundState } from '../../types/glitch';
import { AnimatedNumber } from './AnimatedNumber';
import { Panel } from './Panel';

type Props = {
  round: RoundState;
  buyers: BuyerStat[];
};

export function RoundLeaderboard({ round, buyers }: Props) {
  const [query, setQuery] = useState('');
  const hasStats = round.wallets > 0 || round.buys > 0;
  const subtitle = hasStats ? `${round.wallets} WALLETS · ${round.buys} BUYS` : 'SYNCING LIVE ROUND';
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return buyers.filter(item => item.wallet.toLowerCase().includes(needle)).slice(0, 6);
  }, [buyers, query]);

  return (
    <Panel title="This Round" subtitle={subtitle} className="round-panel">
      <label className="wallet-search">
        <Search size={15} />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search wallet 0x..." />
      </label>
      <div className="leader-head"><span>WALLET</span><span>BUYS</span><span>IN</span></div>
      <div className="leader-table">
        {filtered.map(item => (
          <div className="leader-row" key={item.wallet}>
            <b>{item.wallet.slice(0, 6)}...{item.wallet.slice(-4)}</b>
            <span>{item.buys}</span>
            <strong>${item.inUsd.toFixed(0)}</strong>
          </div>
        ))}
      </div>
      <footer className="round-volume">
        ROUND VOLUME <AnimatedNumber value={round.roundVolumeUsd} prefix="$" decimals={0} />
      </footer>
    </Panel>
  );
}

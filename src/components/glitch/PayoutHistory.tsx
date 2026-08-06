import type { Payout } from '../../types/glitch';
import { Panel } from './Panel';

type Props = { payouts: Payout[] };

export function PayoutHistory({ payouts }: Props) {
  return (
    <Panel title="Settlements" className="history-panel">
      {payouts.length === 0 ? (
        <div className="history-empty">
          <strong>0 rounds settled</strong>
          <div className="history-guides"><span /><span /><span /></div>
          <div className="history-axis"><span>$0</span><span>$0</span></div>
        </div>
      ) : (
        <div className="history-list">
          {payouts.map(payout => (
            <div key={`${payout.roundId}-${payout.timestamp}`}>
              <span>R{payout.roundId}</span>
              <p>{payout.winner.slice(0, 6)}...{payout.winner.slice(-4)}</p>
              <b>${payout.usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</b>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

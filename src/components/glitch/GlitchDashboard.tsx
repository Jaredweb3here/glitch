import { useCallback, useRef, useState } from 'react';
import { useRoundEngine } from '../../hooks/useRoundEngine';
import { useTradeParticles } from '../../hooks/useTradeParticles';
import { AmbientBackground } from './AmbientBackground';
import { CountdownTimer } from './CountdownTimer';
import { FeeSplitChart } from './FeeSplitChart';
import { MechanicsPanel } from './MechanicsPanel';
import { PayoutExecuted } from './PayoutExecuted';
import { PayoutHistory } from './PayoutHistory';
import { PotValue } from './PotValue';
import { RoundLeaderboard } from './RoundLeaderboard';
import { TopNavigation } from './TopNavigation';
import { TradeParticleLayer } from './TradeParticleLayer';
import { TradeStream } from './TradeStream';

export function GlitchDashboard() {
  const potRef = useRef<HTMLDivElement>(null);
  const { particles, spawn } = useTradeParticles();
  const [delta, setDelta] = useState<number | undefined>();

  const onValidTrade = useCallback((trade: { usd: number }) => {
    const potDelta = trade.usd * 0.02 * 0.5;
    setDelta(potDelta);
    window.setTimeout(() => setDelta(undefined), 700);
  }, []);

  const { round, trades, buyers, payouts, lastTradeId, simulateBuy, mode, tokenInfo } = useRoundEngine(onValidTrade);

  return (
    <div className={`glitch-app status-${round.status}`}>
      <AmbientBackground />
      <TopNavigation tokenInfo={tokenInfo} />
      <main className="dashboard-grid">
        <div className="left-column">
          <MechanicsPanel />
          <FeeSplitChart />
          <PayoutHistory payouts={payouts} />
        </div>

        <div className="center-column">
          <CountdownTimer round={round} onBuy={simulateBuy} mode={mode} />
          <PotValue eth={round.potEth} usd={round.potUsd} delta={delta} potRef={potRef} />
          <PayoutExecuted round={round} />
          <div className="round-status">
            ROUND {round.roundId} {round.status === 'active' ? 'LIVE' : round.status === 'payout' ? 'SETTLING' : 'SETTLED — RESTARTING ...'}
          </div>
        </div>

        <div className="right-column">
          <TradeStream trades={trades} lastTradeId={lastTradeId} potRef={potRef} onParticleRequest={spawn} />
          <RoundLeaderboard round={round} buyers={buyers} />
        </div>
      </main>
      <TradeParticleLayer particles={particles} />
    </div>
  );
}

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
    const potDelta = trade.usd * 0.01;
    setDelta(potDelta);
    window.setTimeout(() => setDelta(undefined), 700);
  }, []);

  const { round, trades, buyers, payouts, lastTradeId, simulateBuy, mode, tokenInfo } = useRoundEngine(onValidTrade);

  return (
    <div className={`glitch-app status-${round.status}`}>
      <AmbientBackground />
      <TopNavigation tokenInfo={tokenInfo} />
      <main className="dashboard-grid">
        <section className="command-grid">
          <section className="round-core">
            <div className="round-meta">
              <span>OMAKASE ROUND</span>
              <strong>R-{String(round.roundId).padStart(3, '0')}</strong>
              <small>{round.wallets} wallets / {round.buys} qualifying buys</small>
            </div>
            <PotValue eth={round.potEth} usd={round.potUsd} delta={delta} potRef={potRef} />
            <CountdownTimer round={round} onBuy={simulateBuy} mode={mode} />
            <div className="round-status">
              <span className="status-dot" />
              {round.status === 'active' ? 'ROUND LIVE' : round.status === 'payout' ? 'SETTLEMENT IN PROGRESS' : 'RESTARTING ROUND'}
            </div>
          </section>
          <TradeStream trades={trades} lastTradeId={lastTradeId} potRef={potRef} onParticleRequest={spawn} />
        </section>

        <section className="sushi-story" aria-labelledby="sushi-story-title">
          <div className="story-intro">
            <span>THE SUSHI STORY</span>
            <h2 id="sushi-story-title">One plate.<br />Sixty seconds.<br /><em>Last bite wins.</em></h2>
          </div>
          <ol className="story-steps">
            <li><span>01</span><div><strong>Place an order</strong><p>Every qualifying buy adds its 1% fee to the shared plate.</p></div></li>
            <li><span>02</span><div><strong>Reset the timer</strong><p>A fresh order sends the clock back to sixty seconds.</p></div></li>
            <li><span>03</span><div><strong>Take the plate</strong><p>When the clock reaches zero, the last buyer receives the whole pool.</p></div></li>
          </ol>
          <div className="story-stamp" aria-hidden="true"><span>鮨</span><small>ONCHAIN<br />OMAKASE</small></div>
        </section>

        <section className="intel-grid">
          <RoundLeaderboard round={round} buyers={buyers} />
          <div className="routing-stack">
            <FeeSplitChart />
            <PayoutHistory payouts={payouts} />
          </div>
          <div className="protocol-stack">
            <MechanicsPanel />
            <PayoutExecuted round={round} />
          </div>
        </section>
      </main>
      <TradeParticleLayer particles={particles} />
    </div>
  );
}

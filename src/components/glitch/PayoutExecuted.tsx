import type { RoundState } from '../../types/glitch';
import { AnimatedNumber } from './AnimatedNumber';

type Props = { round: RoundState };

export function PayoutExecuted({ round }: Props) {
  const active = round.status !== 'active';
  return (
    <section className={`payout-panel ${active ? 'is-active' : ''}`}>
      <h2>PLATE SERVED</h2>
      <p>WINNER <span>{round.lastBuyer.slice(0, 6)}...{round.lastBuyer.slice(-4)}</span></p>
      <AnimatedNumber value={active ? round.potEth : 0} decimals={4} prefix="+" suffix=" ETH" className="payout-eth" duration={900} />
      <AnimatedNumber value={active ? round.potUsd : 0} decimals={2} prefix="$" suffix=" USD" className="payout-usd" duration={900} />
    </section>
  );
}

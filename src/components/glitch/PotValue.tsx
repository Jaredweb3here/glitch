import { motion } from 'framer-motion';
import type { RefObject } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

type Props = {
  eth: number;
  usd: number;
  delta?: number;
  potRef: RefObject<HTMLDivElement>;
};

export function PotValue({ eth, usd, delta, potRef }: Props) {
  return (
    <section className="pot-area" ref={potRef}>
      <span className="section-label">THE PLATE</span>
      <motion.div
        className="pot-number-wrap"
        animate={{ scale: delta ? [1, 1.035, 1] : 1 }}
        transition={{ duration: 0.55 }}
      >
        {delta ? <span className="pot-pulse" /> : null}
        <AnimatedNumber value={eth} decimals={4} suffix=" ETH" className="pot-eth" duration={700} />
      </motion.div>
      <AnimatedNumber value={usd} decimals={2} prefix="$" suffix=" USD" className="pot-usd" duration={700} />
      {delta ? <span className="pot-delta">+${delta.toFixed(2)}</span> : null}
    </section>
  );
}

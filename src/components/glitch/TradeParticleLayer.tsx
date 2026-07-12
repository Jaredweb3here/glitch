import { motion } from 'framer-motion';
import type { TradeParticle } from '../../types/glitch';

type Props = { particles: TradeParticle[] };

export function TradeParticleLayer({ particles }: Props) {
  return (
    <div className="particle-layer" aria-hidden="true">
      {particles.map(particle => (
        <motion.span
          key={particle.id}
          className="trade-particle"
          initial={{ x: particle.from.x, y: particle.from.y, opacity: 0, scale: 0.86 }}
          animate={{ x: particle.to.x, y: particle.to.y, opacity: [0, 0.92, 0], scale: [0.86, 1, 0.62] }}
          transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
        >
          {particle.label}
        </motion.span>
      ))}
    </div>
  );
}

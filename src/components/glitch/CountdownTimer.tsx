import { motion } from 'framer-motion';
import { RoundState } from '../../types/glitch';
import { GlitchText } from './GlitchText';

type Props = {
  round: RoundState;
  onBuy: () => void;
  mode: 'live' | 'demo';
};

function format(seconds: number) {
  const safeSeconds = Math.max(1, Math.min(60, Math.floor(seconds || 60)));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function CountdownTimer({ round, onBuy, mode }: Props) {
  const danger = round.secondsLeft <= 10 && round.status === 'active';
  const critical = round.secondsLeft <= 5 && round.status === 'active';

  return (
    <section className={`timer-panel ${danger ? 'danger' : ''} ${critical ? 'critical' : ''} ${round.status !== 'active' ? 'settling' : ''}`}>
      <span className="timer-chip">GLITCH</span>
      <GlitchText active={critical || round.status !== 'active'} className="timer-value">
        {format(round.secondsLeft)}
      </GlitchText>
      <p>LAST BUYER TAKES THE POT</p>
      {round.secondsLeft === 60 && round.status === 'active' && <span className="clock-reset">CLOCK RESET</span>}
      <motion.button
        className="buy-button"
        whileTap={{ scale: 0.985 }}
        onClick={onBuy}
        disabled={mode === 'live'}
      >
        ▶ BUY GLITCH
      </motion.button>
      <span className="edge-symbol left">$</span>
      <span className="edge-symbol right">0x</span>
    </section>
  );
}

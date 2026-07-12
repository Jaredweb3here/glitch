import { useCallback, useState } from 'react';
import type { TradeParticle } from '../types/glitch';

const labels = ['$', '0x', '=', '+'];

export function useTradeParticles() {
  const [particles, setParticles] = useState<TradeParticle[]>([]);

  const spawn = useCallback((source: DOMRect, destination: DOMRect, usd: number) => {
    const count = 3 + Math.floor(Math.random() * 5);
    const next: TradeParticle[] = Array.from({ length: count }, (_, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      label: index === 0 ? `+$${usd.toFixed(0)}` : labels[Math.floor(Math.random() * labels.length)],
      from: {
        x: source.left + source.width * (0.55 + Math.random() * 0.3),
        y: source.top + source.height * (0.25 + Math.random() * 0.5)
      },
      to: {
        x: destination.left + destination.width * (0.35 + Math.random() * 0.3),
        y: destination.top + destination.height * (0.35 + Math.random() * 0.3)
      }
    }));

    setParticles(current => [...current, ...next].slice(-40));
    window.setTimeout(() => {
      setParticles(current => current.filter(item => !next.some(created => created.id === item.id)));
    }, 1200);
  }, []);

  return { particles, spawn };
}

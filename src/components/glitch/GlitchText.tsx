import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  active?: boolean;
  className?: string;
};

export function GlitchText({ children, active = false, className = '' }: Props) {
  return <span className={`glitch-text ${active ? 'is-active' : ''} ${className}`}>{children}</span>;
}

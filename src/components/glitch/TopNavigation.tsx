import { useState } from 'react';
import type { TokenInfo } from '../../types/glitch';

type Props = { tokenInfo?: TokenInfo };

function shortAddress(address?: string) {
  if (!address) return '0x...';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function compactUsd(value?: number) {
  const amount = Number(value || 0);
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

export function TopNavigation({ tokenInfo }: Props) {
  const symbol = tokenInfo?.symbol || 'TOKEN';
  const holders = tokenInfo ? tokenInfo.holderCount || '--' : '--';
  const [copied, setCopied] = useState(false);

  function copyCA() {
    if (!tokenInfo?.address) return;
    navigator.clipboard.writeText(tokenInfo.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <header className="top-nav">
      <div className="brand">
        <svg className="brand-logo" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="uniGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF007A"/>
              <stop offset="100%" stopColor="#FC72FF"/>
            </linearGradient>
          </defs>
          <path d="M20 3 L26 15 L22.5 13 L20 6.5 L17.5 13 L14 15Z" fill="url(#uniGrad)"/>
          <path d="M17 15 L11 9 L16 14Z" fill="url(#uniGrad)"/>
          <ellipse cx="20" cy="25" rx="13" ry="11" fill="url(#uniGrad)"/>
          <ellipse cx="27" cy="29" rx="7" ry="4.5" fill="#FFD4E8"/>
          <circle cx="23" cy="24" r="2.2" fill="white"/>
          <circle cx="23.8" cy="23.5" r="0.9" fill="#1F2937"/>
        </svg>
        <span>UniPonsi</span>
      </div>
      <nav className="nav-center" aria-label="Primary">
        <span className="token-pill active">{symbol}</span>
        <span className="token-pill">MC {compactUsd(tokenInfo?.latestMcUsd)}</span>
        <span className="token-pill">VOL 1M {compactUsd(tokenInfo?.volume1mUsd)}</span>
        <span className="token-pill">HOLDERS {holders}</span>
        <button className="token-pill ca-pill" onClick={copyCA} title={tokenInfo?.address}>
          CA {shortAddress(tokenInfo?.address)}
          <span className="ca-copy">{copied ? '✓' : '⎘'}</span>
        </button>
      </nav>
      <div className="nav-right">
        <div className="live-indicator"><span />LIVE</div>
        <a className="social-link" href="https://x.com/uniponsi" target="_blank" rel="noreferrer" aria-label="UniPonsi on X">X</a>
      </div>
    </header>
  );
}

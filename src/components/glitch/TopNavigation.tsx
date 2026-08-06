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
        <img src="/glitch-logo.png" alt="UniGlitch mark" className="brand-logo" />
        <span>UniGlitch</span>
        <small>ROUND TERMINAL</small>
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
        <a className="social-link" href="https://x.com/uniglitch_fun" target="_blank" rel="noreferrer" aria-label="UniGlitch on X">X</a>
      </div>
    </header>
  );
}

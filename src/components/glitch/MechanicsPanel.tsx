import { Panel } from './Panel';

const rows = [
  'every buy resets the clock to 60s',
  'every trade pays a 2% fee',
  'fee split: 50% pot · 50% marketing',
  'at 0:00 the last buyer takes the pot',
  'next round starts automatically'
];

export function MechanicsPanel() {
  return (
    <Panel title="Mechanics" className="mechanics-panel">
      <div className="mechanics-list">
        {rows.map((row, index) => (
          <div className="mechanic-row" key={row}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{row}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

import { Panel } from './Panel';

const radius = 44;
const circumference = 2 * Math.PI * radius;
const segments = [
  { name: 'POT', value: 100, color: '#1E1E3A' }
];

export function FeeSplitChart() {
  let offset = 0;
  return (
    <Panel title="Fee Split" className="fee-panel">
      <div className="fee-content">
        <div className="donut-wrap">
          <svg viewBox="0 0 120 120" className="donut-svg">
            <circle cx="60" cy="60" r={radius} className="donut-base" />
            {segments.map(segment => {
              const dash = (segment.value / 100) * circumference;
              const strokeDasharray = `${dash} ${circumference - dash}`;
              const strokeDashoffset = -offset;
              offset += dash;
              return (
                <circle
                  key={segment.name}
                  cx="60"
                  cy="60"
                  r={radius}
                  className="donut-segment"
                  stroke={segment.color}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
              );
            })}
          </svg>
          <div className="donut-center"><strong>1%</strong><span>FEE</span></div>
        </div>
        <div className="fee-legend">
          {segments.map(segment => (
            <div key={segment.name}>
              <span style={{ background: segment.color }} />
              <p>{segment.name}</p>
              <b>{segment.value}%</b>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

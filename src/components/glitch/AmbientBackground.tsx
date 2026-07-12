const symbols = ['$', '0x', '▮', '=', '▯', '::'];

export function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="noise" />
      <div className="scanlines" />
      <div className="scanline-sweep" />
      <div className="vignette" />
      {Array.from({ length: 42 }, (_, index) => (
        <span
          key={index}
          className="ambient-symbol"
          style={{
            left: `${(index * 37) % 100}%`,
            top: `${(index * 19) % 100}%`,
            animationDelay: `${(index % 11) * -0.7}s`,
            opacity: 0.08 + (index % 7) * 0.03
          }}
        >
          {symbols[index % symbols.length]}
        </span>
      ))}
    </div>
  );
}

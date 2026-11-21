const BARS = [38, 72, 118, 170, 92, 208, 258, 152, 98, 190, 275, 245, 132, 78, 160, 245, 300, 210, 112, 66, 142, 225, 285, 182, 104, 56, 128, 190, 255, 160, 86, 64, 154, 188, 168, 82, 48, 92, 62, 36];
const ORANGE = new Set([21, 22, 23]);

export const Logo = ({ size = 50, testid = "header-brand-logo", animated = true }) => {
  const gap = 25, w = BARS.length * gap;
  return (
    <svg height={size} viewBox={`0 0 ${w} 320`} data-testid={testid} aria-label="VID logo" style={{ width: (size * w) / 320 }}>
      {BARS.map((h, i) => (
        <rect key={i} x={i * gap + 4} y={160 - h / 2} width="11" height={h} rx="5.5" fill={ORANGE.has(i) ? "#ff8c50" : "#3ee6c4"}
          className={animated ? "vox-eq" : ""} style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${1.1 + (i % 5) * 0.18}s` }} />
      ))}
    </svg>
  );
};

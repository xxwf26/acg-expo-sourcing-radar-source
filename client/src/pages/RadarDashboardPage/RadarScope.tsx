// 雷达扫描可视化（深色 Hero 用）。纯 CSS 动画，无外部依赖。
const BLIPS = [
  { top: '28%', left: '70%', color: '#fca5a5' },
  { top: '20%', left: '40%', color: '#fcd34d' },
  { top: '62%', left: '64%', color: '#5eead4' },
  { top: '56%', left: '30%', color: '#93c5fd' },
  { top: '44%', left: '52%', color: '#fcd34d' },
];

export default function RadarScope({ className = '' }: { className?: string }) {
  return (
    <div className={`radar-scope ${className}`} aria-hidden="true">
      <div className="radar-ring r1" />
      <div className="radar-ring r2" />
      <div className="radar-ring r3" />
      <div className="radar-sweep" />
      {BLIPS.map((b, i) => (
        <span
          key={i}
          className="radar-blip"
          style={{ top: b.top, left: b.left, color: b.color, animationDelay: `${i * 0.4}s` }}
        />
      ))}
    </div>
  );
}

export const ChartSkeleton = ({ label = "Waiting for audio...", height = 200, testid = "chart-skeleton" }) => (
  <div className="relative overflow-hidden rounded-2xl border border-dashed border-[#bfe9e3] bg-[#f6fffd]" style={{ height }} data-testid={testid}>
    <div className="absolute inset-x-4 bottom-8 top-6 flex items-end gap-[6px]">
      {Array.from({ length: 34 }).map((_, i) => (
        <span key={i} className="flex-1 rounded-t-md vox-shimmer vox-rise" style={{ height: `${30 + ((i * 37) % 60)}%`, animationDelay: `${(i % 12) * 0.11}s` }} />
      ))}
    </div>
    <div className="absolute inset-x-4 bottom-7 h-px bg-[#cdeee9]" />
    <span className="absolute top-0 bottom-0 w-24 vox-scanline bg-gradient-to-r from-transparent via-[#5fe3d8]/40 to-transparent" />
    <div className="absolute bottom-2 left-0 right-0 text-center text-xs font-medium text-[#11847c] tracking-wide">{label}</div>
  </div>
);

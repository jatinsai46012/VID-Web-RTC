export const Pill = ({ children, live = true, color = "#10b981", testid }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-[#e6fbf5] px-4 py-1.5 text-sm font-medium text-[#0b5f59] whitespace-nowrap" data-testid={testid}>
    <span className={`h-2.5 w-2.5 rounded-full ${live ? "vox-blink" : ""}`} style={{ background: live ? color : "#94a3b8" }} />
    {children}
  </span>
);

export const CardTitle = ({ icon: Icon, title, right, sub }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-12 w-12 shrink-0 rounded-full bg-[#e3faf6] flex items-center justify-center"><Icon size={23} className="text-[#11847c]" /></span>
      <div className="min-w-0">
        <h2 className="font-display text-xl md:text-[23px] font-bold text-[#0b3f3b] leading-tight">{title}</h2>
        {sub && <p className="text-xs md:text-sm text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
    {right}
  </div>
);

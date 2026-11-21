import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, Activity, History, Settings, Info, ShieldCheck, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadSource, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const NAV = [
  { to: "/", label: "Home", icon: Home, id: "home" },
  { to: "/live", label: "Live Analysis", icon: Activity, id: "live" },
  { to: "/history", label: "History", icon: History, id: "history" },
  { to: "/settings", label: "Settings", icon: Settings, id: "settings" },
  { to: "/about", label: "About", icon: Info, id: "about" },
];

// Admins only (see auth.is_admin in the backend): everyone else never sees it,
// and GET /api/source/download answers 403 regardless.
export const SourceButton = ({ className = "", testid = "download-source-btn" }) => {
  const user = useAuth()?.user;
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await downloadSource(); toast.success("Source code downloaded"); } catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };
  if (!user?.is_admin) return null;
  return (
    <button onClick={go} disabled={busy} data-testid={testid} className={`group flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,transform] active:scale-95 ${className}`}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />}
      Source Code (.zip)
    </button>
  );
};

const Waves = () => (
  <svg className="absolute bottom-0 left-0 w-[120%] h-[60%] pointer-events-none vox-drift" viewBox="0 0 240 400" preserveAspectRatio="none">
    <path d="M0 110 C60 50 140 150 240 80 V400 H0Z" fill="#fff" opacity=".05" />
    <path d="M0 180 C80 120 150 220 240 160 V400 H0Z" fill="#fff" opacity=".06" />
    <path d="M0 260 C70 210 160 290 240 240 V400 H0Z" fill="#042f2c" opacity=".12" />
  </svg>
);

export const Sidebar = () => (
  <aside className="hidden lg:flex relative z-10 w-[238px] shrink-0 flex-col rounded-[22px] bg-[#11847c] p-3 overflow-hidden shadow-[0_24px_48px_-20px_rgba(4,47,44,.6)] min-h-[calc(100vh-140px)] sticky top-4 self-start" data-testid="sidebar">
    <nav className="relative z-10 flex flex-col gap-1.5 mt-2">
      {NAV.map(({ to, label, icon: Icon, id }) => (
        <NavLink key={id} to={to} end data-testid={`nav-${id}-link`}
          className={({ isActive }) => `flex items-center gap-4 rounded-xl px-4 py-3 text-[17px] font-medium transition-[background-color,transform] duration-200 hover:translate-x-1 ${isActive ? "bg-[#2fb0a5] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : "text-white/90 hover:bg-white/10"}`}>
          <Icon size={24} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
    <Waves />
    <div className="relative z-10 mt-auto flex flex-col items-center gap-4 pb-3">
      <SourceButton className="w-full bg-white/15 hover:bg-white/25 text-white py-2.5 text-sm" />
      <ShieldCheck size={34} className="text-white/90" strokeWidth={1.6} />
      <p className="text-sm text-white/90 tracking-wide">Detect • Verify • Stay Safe</p>
    </div>
  </aside>
);

export const MobileNav = () => (
  <nav className="lg:hidden fixed bottom-3 inset-x-3 z-40 flex justify-around rounded-2xl bg-[#11847c] py-2 shadow-2xl" data-testid="mobile-nav">
    {NAV.map(({ to, label, icon: Icon, id }) => (
      <NavLink key={id} to={to} end data-testid={`mobile-nav-${id}-link`}
        className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] ${isActive ? "bg-[#2fb0a5] text-white" : "text-white/80"}`}>
        <Icon size={20} />{label.split(" ")[0]}
      </NavLink>
    ))}
  </nav>
);

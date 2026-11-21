import { useEffect, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "@/context/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const Clock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <div className="hidden md:flex items-center gap-4 text-[#0b3f3b] font-medium" data-testid="header-clock">
      <span>{now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
      <span className="font-mono tabular-nums">{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  );
};

const UserMenu = () => {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initials = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="user-menu-trigger" className="h-11 w-11 rounded-full ring-4 ring-white/60 bg-[#11847c] text-white font-display font-bold text-lg overflow-hidden flex items-center justify-center hover:scale-105 transition-transform">
        {user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl">
        <DropdownMenuLabel>
          <div className="font-semibold truncate" data-testid="user-menu-name">{user?.name}</div>
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="user-menu-settings" onClick={() => nav("/settings")}><Settings size={15} className="mr-2" />Settings</DropdownMenuItem>
        <DropdownMenuItem data-testid="logout-btn" onClick={logout} className="text-red-600"><LogOut size={15} className="mr-2" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Header = () => (
  <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-1 md:px-3 pt-1 pb-5">
    <div className="flex items-center gap-4">
      <Logo size={52} />
      <div>
        <h1 className="font-display text-4xl lg:text-[46px] font-extrabold text-[#0b3f3b] leading-none tracking-tight" data-testid="app-title">VID</h1>
        <p className="text-[#0d5c56] text-xs md:text-[15px] mt-1.5 max-w-[380px] leading-snug">Real-Time WebRTC Audio Deepfake and Voice Impersonating Forensic Detector</p>
      </div>
    </div>
    <div className="flex items-center gap-4 md:gap-5">
      <div className="flex items-center gap-2 rounded-full bg-white/45 backdrop-blur px-4 py-2 text-sm text-[#0b3f3b] font-medium shadow-sm" data-testid="system-status-pill">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" /></span>
        System Online
      </div>
      <span className="hidden md:block h-8 w-px bg-[#0b3f3b]/30" />
      <Clock />
      <UserMenu />
    </div>
  </header>
);

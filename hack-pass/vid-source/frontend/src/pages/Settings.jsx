import { Settings as SettingsIcon, ShieldCheck, UserRound, Code2, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CardTitle, Pill } from "@/components/vox/Pill";
import { SourceButton } from "@/components/vox/Sidebar";

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5" data-testid="settings-page">
      <section className="vox-card p-6">
        <CardTitle icon={UserRound} title="Your account" />
        <div className="mt-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[#11847c] text-white font-display text-2xl font-bold flex items-center justify-center overflow-hidden">{user.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : (user.name || user.email)[0].toUpperCase()}</div>
          <div><div className="font-display text-xl font-bold text-[#0b3f3b]" data-testid="settings-user-name">{user.name}</div><div className="text-slate-500 text-sm" data-testid="settings-user-email">{user.email}</div></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{user.providers.map((p) => <Pill key={p} live={false} testid={`settings-provider-${p}`}>{{ google: "Google sign-in", email: "Email & password", email_otp: "Email code" }[p] || p}</Pill>)}</div>
      </section>
      <section className="vox-card p-6">
        <CardTitle icon={ShieldCheck} title="Sign-in security" right={<Pill testid="settings-otp-status">Email OTP on</Pill>} />
        <p className="mt-4 text-sm text-slate-600">Every email sign-in is confirmed with a one-time 6-digit code sent to <b>{user.email}</b>. Codes expire after 10 minutes and stop working after 5 wrong tries.</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2"><MailCheck size={16} className="text-[#11847c]" />No authenticator app needed</li>
          <li className="flex items-center gap-2"><MailCheck size={16} className="text-[#11847c]" />Google sign-in works with one click</li>
        </ul>
      </section>
      {user?.is_admin && (
        <section className="vox-card p-6 xl:col-span-2 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#5fe3d8]/25 blur-2xl" />
          <CardTitle icon={Code2} title="Download the source code" sub="Full VID project: FastAPI backend + React frontend (secrets excluded)" />
          <SourceButton className="mt-5 bg-[#11847c] hover:bg-[#0c625c] text-white px-6 py-3.5" testid="settings-download-source-btn" />
        </section>
      )}
      <section className="vox-card p-6 xl:col-span-2">
        <CardTitle icon={SettingsIcon} title="Recording rules" />
        <ul className="mt-4 grid sm:grid-cols-3 gap-3 text-sm text-slate-600">
          <li className="rounded-xl bg-[#f3fdfb] border border-[#d8f2ee] p-4"><b className="block text-[#0b3f3b]">Max 30 seconds</b>Each scan stops automatically.</li>
          <li className="rounded-xl bg-[#f3fdfb] border border-[#d8f2ee] p-4"><b className="block text-[#0b3f3b]">Audio is not stored</b>Only the verdict and charts are saved.</li>
          <li className="rounded-xl bg-[#f3fdfb] border border-[#d8f2ee] p-4"><b className="block text-[#0b3f3b]">Speaker capture</b>Share the call tab/screen with "Share audio" ON.</li>
        </ul>
      </section>
    </div>
  );
}

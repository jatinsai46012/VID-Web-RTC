import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, Check, AudioLines, Zap, Send, MailCheck, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { fmtTime } from "@/lib/audio";
import { useAuth } from "@/context/AuthContext";
import { PeakWaves } from "@/components/vox/PeakWaves";
import { Logo } from "@/components/vox/Logo";
import { OtpField } from "@/components/vox/OtpField";

const STEPS = ["Your email", "Enter code", "Access"];
const stepIndex = { choose: 0, email: 0, otp: 1, success: 2 };

const Stepper = ({ step }) => (
  <div className="flex items-center gap-2 mb-7" data-testid="login-stepper">
    {STEPS.map((s, i) => {
      const on = stepIndex[step] >= i;
      return (
        <div key={s} className="flex items-center gap-2 flex-1">
          <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-500 ${on ? "bg-[#5fe3d8] text-[#032623]" : "bg-white/10 text-white/50"}`}>{stepIndex[step] > i ? <Check size={14} /> : i + 1}</span>
          <span className={`text-xs hidden sm:block ${on ? "text-white" : "text-white/40"}`}>{s}</span>
          {i < 2 && <span className={`flex-1 h-px ${stepIndex[step] > i ? "bg-[#5fe3d8]" : "bg-white/15"}`} />}
        </div>
      );
    })}
  </div>
);

const inputCls = "w-full rounded-xl bg-white/[0.06] border border-white/15 px-4 py-3.5 text-white placeholder:text-white/35 outline-none focus:border-[#5fe3d8] focus:ring-2 focus:ring-[#5fe3d8]/30 transition-[border-color,box-shadow]";
const primaryBtn = "w-full flex items-center justify-center gap-2 rounded-xl bg-[#5fe3d8] text-[#032623] font-bold py-3.5 hover:bg-[#7af0e6] active:scale-[.98] transition-[background-color,transform] disabled:opacity-60";
const Title = ({ children, sub }) => (<><h2 className="font-display text-3xl font-extrabold text-white">{children}</h2>{sub && <p className="text-white/60 mt-2 text-sm leading-relaxed">{sub}</p>}</>);

function ChooseStep({ onEmail }) {
  return (
    <div>
      <Title sub="Email sign-in uses a quick one-time code. No password or extra app needed.">Welcome to VID</Title>
      <div className="mt-8">
        <button onClick={onEmail} data-testid="login-email-option-btn" className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#5fe3d8] text-[#032623] font-bold py-3.5 hover:bg-[#7af0e6] active:scale-[.98] transition-[background-color,transform]">
          <Mail size={19} /> Sign in with Email
        </button>
      </div>
      <p className="mt-8 flex items-center gap-2 text-xs text-white/45"><ShieldCheck size={14} className="text-[#5fe3d8]" />Protected by one-time email codes & brute-force lockout</p>
    </div>
  );
}

const MODES = [["code", "Email code"], ["login", "Password"], ["register", "New account"]];

function EmailStep({ onBack, onStage }) {
  const [mode, setMode] = useState("code");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const req = { code: ["/auth/otp/request", { email: form.email }], login: ["/auth/login", { email: form.email, password: form.password }], register: ["/auth/register", form] }[mode];
      const { data } = await api.post(...req);
      onStage(data);
    } catch (e2) { setErr(formatApiError(e2)); }
    setBusy(false);
  };
  const sub = { code: "No password needed. We'll email you a 6-digit code.", login: "Enter your password - then confirm with a code sent to your email.", register: "Create your account in seconds." }[mode];
  return (
    <form onSubmit={submit}>
      <button type="button" onClick={onBack} data-testid="login-back-btn" className="flex items-center gap-1 text-white/60 text-sm mb-5 hover:text-white"><ArrowLeft size={15} />Back</button>
      <Title sub={sub}>{mode === "register" ? "Create account" : "Sign in with Email"}</Title>
      <div className="mt-6 grid grid-cols-3 rounded-xl bg-white/[0.06] p-1 text-sm">
        {MODES.map(([m, label]) => (
          <button type="button" key={m} onClick={() => { setMode(m); setErr(""); }} data-testid={`login-mode-${m}`} className={`rounded-lg py-2 font-semibold transition-colors ${mode === m ? "bg-[#5fe3d8] text-[#032623]" : "text-white/60"}`}>{label}</button>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {mode === "register" && <input required className={inputCls} placeholder="Full name" value={form.name} onChange={set("name")} data-testid="register-name-input" />}
        <input required type="email" className={inputCls} placeholder="you@example.com" value={form.email} onChange={set("email")} data-testid="login-email-input" />
        {mode !== "code" && (
          <div className="relative">
            <input required type={show ? "text" : "password"} minLength={mode === "register" ? 8 : 1} className={inputCls} placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"} value={form.password} onChange={set("password")} data-testid="login-password-input" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50" data-testid="toggle-password-visibility" aria-label="Toggle password">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        )}
      </div>
      {err && <p className="mt-3 text-sm text-red-300" data-testid="login-error">{err}</p>}
      <button disabled={busy} className={`${primaryBtn} mt-6`} data-testid="login-submit-btn">{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}{mode === "code" ? "Send me a code" : mode === "login" ? "Continue" : "Create account"}</button>
    </form>
  );
}

const useCountdown = (initial) => {
  const [left, setLeft] = useState(initial);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft((l) => l - 1), 1000); return () => clearTimeout(t); }, [left]);
  return [left, setLeft];
};

function OtpStep({ info, onDone, onBack }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resendIn, setResendIn] = useCountdown(info.resend_in || 30);
  const [expires, setExpires] = useCountdown(info.expires_in || 600);
  const verify = async (c = code) => {
    if (c.length !== 6) return;
    setBusy(true); setErr("");
    try { const r = await api.post("/auth/otp/verify", { email: info.email, code: c, name: name || undefined }); onDone(r.data.user); }
    catch (e) { setErr(formatApiError(e)); setCode(""); }
    setBusy(false);
  };
  const resend = async () => {
    setErr("");
    try { const { data } = await api.post("/auth/otp/request", { email: info.email }); setResendIn(data.resend_in); setExpires(data.expires_in); setCode(""); toast.success("New code sent - check your inbox"); }
    catch (e) { setErr(formatApiError(e)); }
  };
  return (
    <div>
      <button type="button" onClick={onBack} data-testid="otp-back-btn" className="flex items-center gap-1 text-white/60 text-sm mb-5 hover:text-white"><ArrowLeft size={15} />Change email</button>
      <div className="relative h-14 w-14 rounded-2xl bg-[#5fe3d8]/15 flex items-center justify-center mb-5">
        <span className="absolute inset-0 rounded-2xl border border-[#5fe3d8] vox-ripple" />
        <MailCheck size={28} className="text-[#5fe3d8]" />
      </div>
      <Title sub={<>We sent a 6-digit code to <b className="text-white" data-testid="otp-email">{info.email}</b>. Check your inbox (and spam).</>}>Check your email</Title>
      {info.is_new && <input className={`${inputCls} mt-6`} placeholder="Your name (new here!)" value={name} onChange={(e) => setName(e.target.value)} data-testid="otp-name-input" />}
      <div className="mt-6"><OtpField value={code} onChange={setCode} onComplete={verify} testid="email-otp-input" /></div>
      <p className="mt-3 text-center text-xs text-white/45 font-mono" data-testid="otp-expiry">{expires > 0 ? `Code expires in ${fmtTime(expires)}` : "Code expired - send a new one"}</p>
      {err && <p className="mt-2 text-sm text-red-300 text-center" data-testid="otp-error">{err}</p>}
      <button disabled={busy || code.length !== 6} onClick={() => verify()} className={`${primaryBtn} mt-5`} data-testid="otp-verify-btn">{busy && <Loader2 size={18} className="animate-spin" />}Verify & sign in</button>
      <button disabled={resendIn > 0} onClick={resend} className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-[#5fe3d8] disabled:text-white/35 hover:underline disabled:no-underline" data-testid="otp-resend-btn">
        <RotateCw size={14} />{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
      </button>
    </div>
  );
}

const Success = ({ name }) => (
  <div className="text-center py-6" data-testid="login-success">
    <div className="relative mx-auto h-28 w-28">
      {[0, 0.4, 0.8].map((d) => <span key={d} className="absolute inset-0 rounded-full border-2 border-[#5fe3d8] vox-ripple" style={{ animationDelay: `${d}s` }} />)}
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="absolute inset-0 rounded-full bg-[#5fe3d8] flex items-center justify-center"><Check size={52} className="text-[#032623]" strokeWidth={3} /></motion.div>
    </div>
    <h2 className="font-display text-3xl font-extrabold text-white mt-8">Access granted</h2>
    <p className="text-white/60 mt-2">Welcome{name ? `, ${name.split(" ")[0]}` : ""}. Opening your shield...</p>
  </div>
);

const Feature = ({ icon: Icon, title, text }) => (
  <div className="flex gap-4"><span className="h-11 w-11 shrink-0 rounded-xl bg-[#5fe3d8]/12 border border-[#5fe3d8]/25 flex items-center justify-center"><Icon size={20} className="text-[#5fe3d8]" /></span><div><div className="text-white font-semibold">{title}</div><div className="text-white/50 text-sm">{text}</div></div></div>
);

export default function Login() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState("choose");
  const [pending, setPending] = useState(null);
  const [authed, setAuthed] = useState(null);

  if (user && step !== "success") return <Navigate to="/" replace />;

  const onStage = (d) => { setPending(d); setStep("otp"); };
  const finish = (u) => { setAuthed(u); setStep("success"); setTimeout(() => { setUser(u); nav("/", { replace: true }); }, 1600); };
  const intensity = { choose: 1, email: 1.2, otp: 1.45, success: 2.4 }[step];

  return (
    <div className="relative min-h-screen bg-[#031a19] overflow-hidden" data-testid="login-page">
      <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_15%_10%,rgba(17,132,124,.35),transparent_60%),radial-gradient(700px_500px_at_90%_90%,rgba(95,227,216,.12),transparent_60%)]" />
      <PeakWaves intensity={intensity} />
      <div className="relative z-10 min-h-screen grid lg:grid-cols-2 gap-10 items-center px-6 md:px-14 py-10 max-w-7xl mx-auto">
        <div className="hidden lg:block vox-fadeup">
          <div className="flex items-center gap-3"><Logo size={42} testid="login-logo" /><span className="font-display text-3xl font-extrabold text-white">VID</span></div>
          <h1 className="font-display text-5xl xl:text-6xl font-extrabold text-white leading-[1.02] mt-10 tracking-tight">Is that voice real<br /><span className="text-[#5fe3d8]">- or made by AI?</span></h1>
          <p className="text-white/60 mt-6 text-lg max-w-md">Record any call or voice and get a clear, simple answer in seconds.</p>
          <div className="mt-10 space-y-5 max-w-md">
            <Feature icon={AudioLines} title="Live pitch & waveform" text="Watch the voice being analysed in real time." />
            <Feature icon={Zap} title="AI forensic verdict" text="Deepfake & impersonation scores in plain words." />
            <Feature icon={ShieldCheck} title="One-time email codes" text="Sign in with a quick 6-digit code - no app needed." />
          </div>
        </div>
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-[460px] mx-auto rounded-[28px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-7 md:p-9 shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]" data-testid="login-card">
          <div className="lg:hidden flex items-center gap-3 mb-6"><Logo size={30} testid="login-logo-mobile" /><span className="font-display text-2xl font-extrabold text-white">VID</span></div>
          <Stepper step={step} />
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28 }}>
              {step === "choose" && <ChooseStep onEmail={() => setStep("email")} />}
              {step === "email" && <EmailStep onBack={() => setStep("choose")} onStage={onStage} />}
              {step === "otp" && pending && <OtpStep info={pending} onBack={() => setStep("email")} onDone={finish} />}
              {step === "success" && <Success name={authed?.name} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

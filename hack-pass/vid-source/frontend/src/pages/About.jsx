import { Info, MonitorSpeaker, Mic, ShieldCheck, ShieldAlert, ShieldX, Waves, Wind, Bot, BrainCircuit } from "lucide-react";
import { CardTitle } from "@/components/vox/Pill";

const Step = ({ n, icon: Icon, title, text }) => (
  <div className="relative rounded-2xl bg-[#f3fdfb] border border-[#d8f2ee] p-5 hover:-translate-y-1 transition-transform" data-testid={`about-step-${n}`}>
    <span className="absolute -top-3 left-5 rounded-full bg-[#11847c] text-white text-xs font-bold px-3 py-1">STEP {n}</span>
    <Icon size={30} className="text-[#11847c] mt-2" />
    <h3 className="font-display text-lg font-bold text-[#0b3f3b] mt-3">{title}</h3>
    <p className="text-sm text-slate-600 mt-1">{text}</p>
  </div>
);

const Signal = ({ icon: Icon, title, text }) => (
  <div className="flex gap-4"><span className="h-11 w-11 shrink-0 rounded-full bg-[#e6fbf8] flex items-center justify-center"><Icon size={20} className="text-[#11847c]" /></span><div><b className="text-[#0b3f3b]">{title}</b><p className="text-sm text-slate-600">{text}</p></div></div>
);

export default function About() {
  return (
    <div className="flex flex-col gap-5" data-testid="about-page">
      <section className="vox-card p-6 md:p-8">
        <CardTitle icon={Info} title="What is VID?" />
        <p className="mt-4 text-slate-600 max-w-3xl text-[15px] leading-relaxed">Scammers can now copy anyone's voice with AI apps. VID listens to a call or a voice near you and tells you, in simple words, whether it sounds like a <b className="text-emerald-600">real person</b> or a <b className="text-red-500">computer-made voice</b>.</p>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          <Step n={1} icon={MonitorSpeaker} title="Pick the source" text="'Capture Speaker Output' for a call playing on your device, or 'Use Microphone' for someone talking nearby." />
          <Step n={2} icon={Mic} title="Let them talk" text="Up to 30 seconds. Watch the live pitch and the live detection chart move." />
          <Step n={3} icon={ShieldCheck} title="Read the verdict" text="Green = real. Amber = be careful. Red = likely AI-generated." />
        </div>
      </section>
      <div className="grid xl:grid-cols-2 gap-5">
        <section className="vox-card p-6 md:p-8">
          <CardTitle icon={BrainCircuit} title="How do we know?" />
          <div className="mt-6 space-y-5">
            <Signal icon={Waves} title="Pitch wobble" text="Human voices naturally go up and down. AI voices are often too smooth." />
            <Signal icon={Wind} title="Breathing & pauses" text="Real people breathe and pause unevenly. Many AI voices don't." />
            <Signal icon={Bot} title="Robotic artifacts" text="Tiny metallic or buzzy sounds left behind by voice generators." />
            <Signal icon={BrainCircuit} title="AI forensic listener" text="A Gemini AI model listens to the whole clip and gives the final verdict." />
          </div>
        </section>
        <section className="vox-card p-6 md:p-8">
          <CardTitle icon={ShieldCheck} title="Reading the result" />
          <div className="mt-6 space-y-3">
            {[[ShieldCheck, "#10b981", "Authentic Voice (0-34%)", "Sounds like a real human."], [ShieldAlert, "#f59e0b", "Suspicious (35-64%)", "Something feels off. Call the person back on a known number."], [ShieldX, "#ef4444", "AI-Generated (65-100%)", "Very likely fake. Don't share money, codes or passwords."]].map(([Icon, c, t, d]) => (
              <div key={t} className="flex gap-4 items-center rounded-2xl p-4" style={{ background: `${c}12` }}>
                <Icon size={30} style={{ color: c }} /><div><b style={{ color: c }}>{t}</b><p className="text-sm text-slate-600">{d}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-slate-500">No detector is 100% perfect. Use VID as a strong warning signal, not a final proof.</p>
        </section>
      </div>
    </div>
  );
}

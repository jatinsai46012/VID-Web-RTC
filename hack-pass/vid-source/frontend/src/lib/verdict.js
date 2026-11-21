import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

export const VERDICTS = {
  authentic: { label: "Authentic Voice", short: "Authentic", color: "#10b981", soft: "#ecfdf5", icon: ShieldCheck, text: "No signs of deepfake or impersonation detected." },
  suspicious: { label: "Suspicious Voice", short: "Suspicious", color: "#f59e0b", soft: "#fffbeb", icon: ShieldAlert, text: "Some unusual patterns. Verify the caller another way." },
  deepfake: { label: "AI-Generated Voice", short: "AI-Generated", color: "#ef4444", soft: "#fef2f2", icon: ShieldX, text: "Strong signs this voice was made by an AI app." },
};

export const riskColor = (v) => (v >= 65 ? "#ef4444" : v >= 35 ? "#f59e0b" : "#10b981");

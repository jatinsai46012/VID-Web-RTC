import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const OtpField = ({ value, onChange, onComplete, testid = "totp-otp-input", dark = true }) => (
  <InputOTP maxLength={6} value={value} onChange={onChange} onComplete={onComplete} data-testid={testid} autoFocus containerClassName="justify-center">
    <InputOTPGroup className="gap-2 sm:gap-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <InputOTPSlot key={i} index={i}
          className={`h-14 w-11 sm:w-12 rounded-xl border text-xl font-mono font-bold first:rounded-xl last:rounded-xl ${dark ? "border-white/15 bg-white/[0.06] text-white" : "border-[#bfe9e3] bg-[#f6fffd] text-[#0b3f3b]"}`} />
      ))}
    </InputOTPGroup>
  </InputOTP>
);

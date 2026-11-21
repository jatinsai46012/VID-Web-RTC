import { LiveDetectionCard } from "@/components/vox/LiveDetectionCard";
import { WaveformCard } from "@/components/vox/WaveformCard";
import { ResultCard } from "@/components/vox/ResultCard";
import { PitchCard } from "@/components/vox/PitchCard";
import { LiveRiskCard } from "@/components/vox/LiveRiskCard";

export default function Live() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5" data-testid="live-page">
      <div className="xl:col-span-8 flex flex-col gap-5">
        <PitchCard height={300} />
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5"><LiveRiskCard height={220} /><WaveformCard /></div>
      </div>
      <div className="xl:col-span-4 flex flex-col gap-5"><LiveDetectionCard compact /><ResultCard /></div>
    </div>
  );
}

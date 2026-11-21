import { LiveDetectionCard } from "@/components/vox/LiveDetectionCard";
import { WaveformCard } from "@/components/vox/WaveformCard";
import { ResultCard } from "@/components/vox/ResultCard";
import { ActivityLog } from "@/components/vox/ActivityLog";
import { PitchCard } from "@/components/vox/PitchCard";
import { LiveRiskCard } from "@/components/vox/LiveRiskCard";

export default function Home() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5" data-testid="home-page">
      <div className="xl:col-span-7 flex flex-col gap-5"><LiveDetectionCard /><WaveformCard /></div>
      <div className="xl:col-span-5 flex flex-col gap-5"><ResultCard /><ActivityLog /></div>
      <div className="xl:col-span-7"><PitchCard /></div>
      <div className="xl:col-span-5"><LiveRiskCard /></div>
    </div>
  );
}

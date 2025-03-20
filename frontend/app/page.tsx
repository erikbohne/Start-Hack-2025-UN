import { VercelV0Chat } from "@/components/ui/v0-ai-chat";
import Map from '@/components/Map';
import { StackingNavbar } from "@/components/ui/stacking-navbar";

export default function Home() {
  return (
    <main className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <Map />
      </div>
      <StackingNavbar />
      <div className="absolute right-0 top-0 h-full">
        <VercelV0Chat />
      </div>
    </main>
  );
}

import { VercelV0Chat } from "@/components/ui/v0-ai-chat";
import Map from '@/components/Map';

export default function Home() {
  return (
    <main className="flex h-screen w-full overflow-hidden">
      <div className="w-3/5 h-full">
        <Map />
      </div>
      <div className="w-2/5 h-full">
        <VercelV0Chat />
      </div>
    </main>
  );
}

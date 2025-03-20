import { VercelV0Chat } from "@/components/ui/v0-ai-chat";
import MapBox from '@/components/custom/MapBox';

export default function Home() {
  return (
    <div className="flex w-full">
      <div className="w-3/5">
        <MapBox />
      </div>
      <div className="w-2/5 flex items-center justify-center">
        <VercelV0Chat />
      </div>
    </div>
  );
}

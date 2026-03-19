import { WifiOff } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
      "bg-destructive text-destructive-foreground",
      "px-4 py-2 rounded-full shadow-lg",
      "flex items-center gap-2 text-sm font-medium",
      "animate-in slide-in-from-bottom-4"
    )}>
      <WifiOff className="h-4 w-4" />
      <span>Sin conexión</span>
    </div>
  );
}

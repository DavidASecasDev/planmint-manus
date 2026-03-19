import { useCallback } from "react";
import { usePWA } from "./usePWA";
import { toast } from "@/hooks/use-toast";

type OfflineAction = "create" | "update" | "delete" | "payment" | "ai";

const actionMessages: Record<OfflineAction, string> = {
  create: "No puedes crear elementos sin conexión",
  update: "No puedes modificar elementos sin conexión",
  delete: "No puedes eliminar elementos sin conexión",
  payment: "Los pagos requieren conexión a internet",
  ai: "Las funciones de IA requieren conexión a internet",
};

export function useOfflineGuard() {
  const { isOnline } = usePWA();

  const guardAction = useCallback(
    <T extends (...args: any[]) => any>(
      action: T,
      actionType: OfflineAction = "update"
    ): T => {
      return ((...args: Parameters<T>) => {
        if (!isOnline) {
          toast({
            title: "Sin conexión",
            description: actionMessages[actionType],
            variant: "destructive",
          });
          return undefined;
        }
        return action(...args);
      }) as T;
    },
    [isOnline]
  );

  const checkOnline = useCallback(
    (actionType: OfflineAction = "update"): boolean => {
      if (!isOnline) {
        toast({
          title: "Sin conexión",
          description: actionMessages[actionType],
          variant: "destructive",
        });
        return false;
      }
      return true;
    },
    [isOnline]
  );

  return {
    isOnline,
    guardAction,
    checkOnline,
  };
}

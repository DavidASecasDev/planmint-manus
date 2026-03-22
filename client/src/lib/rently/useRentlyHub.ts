/**
 * useRentlyHub — Hook React para interactuar con el Rently Integration Hub
 *
 * Proporciona una interfaz limpia para que los componentes de PlanMint
 * consulten la API de Rently a través del endpoint Express /api/rently-hub.
 */

import { useState, useCallback } from "react";
import { apiInvoke } from "@/lib/apiClient";

export interface RentlyHubResponse<T = unknown> {
  success: boolean;
  data?: T;
  raw?: unknown;
  error?: string;
  errorType?: string;
  elapsed?: number;
  domain?: string;
  method?: string;
}

export interface RentlyDomainInfo {
  name: string;
  label: string;
  description: string;
  syncStrategy: string;
  endpoints: {
    method: string;
    path: string;
    description: string;
    type: string;
  }[];
}

export interface RentlyRegistryResponse {
  success: boolean;
  domains: RentlyDomainInfo[];
  totalDomains: number;
  totalEndpoints: number;
}

export function useRentlyHub() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Llama al endpoint Express rently-hub con el body especificado
   */
  const invoke = useCallback(async <T = unknown>(
    body: Record<string, unknown>
  ): Promise<RentlyHubResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await apiInvoke<RentlyHubResponse<T>>("rently-hub", {
        body,
      });

      if (fnError) {
        const errorMsg = fnError.message || "Error al conectar con Rently Hub";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!data?.success) {
        const errorMsg = data?.error || "Error desconocido";
        setError(errorMsg);
        return data as RentlyHubResponse<T>;
      }

      return data as RentlyHubResponse<T>;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error inesperado";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Obtiene el registro de dominios disponibles
   */
  const getRegistry = useCallback(async (): Promise<RentlyRegistryResponse | null> => {
    const result = await invoke<RentlyRegistryResponse>({ action: "registry" });
    return result.success ? (result as unknown as RentlyRegistryResponse) : null;
  }, [invoke]);

  /**
   * Prueba la conexión con Rently
   */
  const testConnection = useCallback(async () => {
    return invoke({ action: "test" });
  }, [invoke]);

  /**
   * Consulta un dominio específico
   */
  const query = useCallback(async <T = unknown>(
    domain: string,
    method: string,
    params?: Record<string, unknown>
  ): Promise<RentlyHubResponse<T>> => {
    return invoke<T>({ action: "query", domain, method, params });
  }, [invoke]);

  /**
   * Explora un endpoint raw de Rently
   */
  const explore = useCallback(async <T = unknown>(
    endpoint: string,
    httpMethod: string = "GET",
    params?: Record<string, unknown>
  ): Promise<RentlyHubResponse<T>> => {
    return invoke<T>({ action: "explore", endpoint, httpMethod, params });
  }, [invoke]);

  return {
    loading,
    error,
    invoke,
    getRegistry,
    testConnection,
    query,
    explore,
  };
}

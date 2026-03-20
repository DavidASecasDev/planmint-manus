/**
 * RentlyExplorer — Panel interno de administración para el Rently Integration Hub
 *
 * Permite a los administradores:
 * - Ver todos los dominios y endpoints disponibles
 * - Ejecutar consultas en vivo a la API de Rently
 * - Ver el payload original (raw) y el normalizado
 * - Probar la conexión
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRentlyHub } from "@/lib/rently/useRentlyHub";
import type { RentlyDomainInfo } from "@/lib/rently/useRentlyHub";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Activity,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  Globe,
  Database,
  Zap,
  Clock,
  Search,
  RefreshCw,
  Copy,
  Terminal,
  LayoutDashboard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────

interface ExplorerResult {
  success: boolean;
  data?: unknown;
  raw?: unknown;
  error?: string;
  errorType?: string;
  elapsed?: number;
  endpoint?: string;
  method?: string;
  domain?: string;
}

// ─── Sync Strategy Badges ────────────────────────────────────────

const syncStrategyConfig: Record<string, { label: string; color: string }> = {
  polling_frequent: { label: "Polling frecuente", color: "bg-red-100 text-red-800" },
  polling_daily: { label: "Polling diario", color: "bg-orange-100 text-orange-800" },
  on_demand: { label: "Bajo demanda", color: "bg-blue-100 text-blue-800" },
  cache_long: { label: "Cache largo", color: "bg-green-100 text-green-800" },
};

const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800",
  POST: "bg-blue-100 text-blue-800",
  PUT: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

// ─── Main Component ──────────────────────────────────────────────

export default function RentlyExplorer() {
  const { loading, error, getRegistry, testConnection, explore } = useRentlyHub();
  const { toast } = useToast();

  const [domains, setDomains] = useState<RentlyDomainInfo[]>([]);
  const [totalEndpoints, setTotalEndpoints] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [connectionProfile, setConnectionProfile] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState("domains");

  // Explorer state
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("GET");
  const [queryParams, setQueryParams] = useState("");
  const [result, setResult] = useState<ExplorerResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Domain filter
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  // ─── Load Registry ───────────────────────────────────────────

  useEffect(() => {
    loadRegistry();
  }, []);

  const loadRegistry = useCallback(async () => {
    const registry = await getRegistry();
    if (registry) {
      setDomains(registry.domains);
      setTotalEndpoints(registry.totalEndpoints);
    }
  }, [getRegistry]);

  // ─── Test Connection ─────────────────────────────────────────

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus("testing");
    const result = await testConnection();
    if (result.success) {
      setConnectionStatus("ok");
      setConnectionProfile(((result as unknown as Record<string, unknown>).profile as Record<string, unknown>) || null);
      toast({
        title: "Conexion exitosa",
        description: "PlanMint puede comunicarse con Rently correctamente.",
      });
    } else {
      setConnectionStatus("error");
      toast({
        title: "Error de conexion",
        description: result.error || "No se pudo conectar con Rently",
        variant: "destructive",
      });
    }
  }, [testConnection, toast]);

  // ─── Execute Endpoint ────────────────────────────────────────

  const handleExecute = useCallback(async () => {
    if (!selectedEndpoint) {
      toast({ title: "Selecciona un endpoint", variant: "destructive" });
      return;
    }

    setIsExecuting(true);
    setResult(null);

    let params: Record<string, unknown> | undefined;
    if (queryParams.trim()) {
      try {
        params = JSON.parse(queryParams);
      } catch {
        toast({ title: "JSON invalido en parametros", variant: "destructive" });
        setIsExecuting(false);
        return;
      }
    }

    const response = await explore(selectedEndpoint, selectedMethod, params);
    setResult(response as ExplorerResult);
    setIsExecuting(false);
  }, [selectedEndpoint, selectedMethod, queryParams, explore, toast]);

  // ─── Select Endpoint from Domain ─────────────────────────────

  const handleSelectEndpoint = useCallback((path: string, method: string) => {
    setSelectedEndpoint(path);
    setSelectedMethod(method);
    setActiveTab("explorer");
    setResult(null);
    setQueryParams("");
  }, []);

  // ─── Toggle Domain ───────────────────────────────────────────

  const toggleDomain = useCallback((name: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  // ─── Copy to Clipboard ──────────────────────────────────────

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  }, [toast]);

  // ─── Filtered Domains ───────────────────────────────────────

  const filteredDomains = domains.filter((d) => {
    if (!searchFilter) return true;
    const lower = searchFilter.toLowerCase();
    return (
      d.name.toLowerCase().includes(lower) ||
      d.label.toLowerCase().includes(lower) ||
      d.description.toLowerCase().includes(lower) ||
      d.endpoints.some(
        (e) =>
          e.path.toLowerCase().includes(lower) ||
          e.description.toLowerCase().includes(lower)
      )
    );
  });

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            Rently Integration Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Panel de administracion para explorar y gestionar la integracion con Rently
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Database className="h-3 w-3 mr-1" />
            {domains.length} dominios
          </Badge>
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Zap className="h-3 w-3 mr-1" />
            {totalEndpoints} endpoints
          </Badge>
          <Button
            onClick={handleTestConnection}
            variant={connectionStatus === "ok" ? "outline" : "default"}
            disabled={connectionStatus === "testing"}
          >
            {connectionStatus === "testing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : connectionStatus === "ok" ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
            ) : connectionStatus === "error" ? (
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            {connectionStatus === "testing"
              ? "Probando..."
              : connectionStatus === "ok"
              ? "Conectado"
              : connectionStatus === "error"
              ? "Error"
              : "Probar conexion"}
          </Button>
        </div>
      </div>

      {/* Connection Profile */}
      {connectionProfile && (
        <Alert className="mb-4">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Conectado a Rently</AlertTitle>
          <AlertDescription>
            Usuario: {String(connectionProfile?.FullName || "N/A")} |
            Email: {String(connectionProfile?.Email || "N/A")}
          </AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="domains" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dominios
          </TabsTrigger>
          <TabsTrigger value="explorer" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Explorer
          </TabsTrigger>
        </TabsList>

        {/* ─── Domains Tab ──────────────────────────────────────── */}
        <TabsContent value="domains">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar dominios o endpoints..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredDomains.map((domain) => (
              <Collapsible
                key={domain.name}
                open={expandedDomains.has(domain.name)}
                onOpenChange={() => toggleDomain(domain.name)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedDomains.has(domain.name) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <CardTitle className="text-lg">{domain.label}</CardTitle>
                            <CardDescription className="mt-1">
                              {domain.description}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {domain.endpoints.length} endpoints
                          </Badge>
                          <Badge
                            className={
                              syncStrategyConfig[domain.syncStrategy]?.color ||
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {syncStrategyConfig[domain.syncStrategy]?.label ||
                              domain.syncStrategy}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Separator className="mb-4" />
                      <div className="space-y-2">
                        {domain.endpoints.map((ep, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                className={`font-mono text-xs min-w-[52px] justify-center ${
                                  methodColors[ep.method] || "bg-gray-100"
                                }`}
                              >
                                {ep.method}
                              </Badge>
                              <code className="text-sm font-mono text-muted-foreground">
                                {ep.path}
                              </code>
                              <span className="text-sm text-muted-foreground hidden md:inline">
                                — {ep.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Badge variant="outline" className="text-xs">
                                {ep.type}
                              </Badge>
                              {ep.type === "read" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectEndpoint(ep.path, ep.method);
                                  }}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Probar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        </TabsContent>

        {/* ─── Explorer Tab ─────────────────────────────────────── */}
        <TabsContent value="explorer">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Request Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Request
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="/api/cars"
                    value={selectedEndpoint}
                    onChange={(e) => setSelectedEndpoint(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Parametros (JSON)
                  </label>
                  <Textarea
                    placeholder='{"offset": 0, "limit": 10}'
                    value={queryParams}
                    onChange={(e) => setQueryParams(e.target.value)}
                    className="font-mono text-sm min-h-[120px]"
                  />
                </div>

                <Button
                  onClick={handleExecute}
                  disabled={isExecuting || !selectedEndpoint}
                  className="w-full"
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isExecuting ? "Ejecutando..." : "Ejecutar"}
                </Button>

                {/* Quick Actions */}
                <div>
                  <p className="text-sm font-medium mb-2">Accesos rapidos:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Perfil", path: "/api/Profile", method: "GET" },
                      { label: "Sucursales", path: "/api/branchoffices", method: "GET" },
                      { label: "Vehiculos", path: "/api/cars", method: "GET" },
                      { label: "Categorias", path: "/api/categories", method: "GET" },
                      { label: "Reservas", path: "/api/bookings", method: "GET" },
                      { label: "Clientes", path: "/api/customers", method: "GET" },
                    ].map((shortcut) => (
                      <Button
                        key={shortcut.path}
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectEndpoint(shortcut.path, shortcut.method)}
                      >
                        {shortcut.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Response Panel */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Response
                  </CardTitle>
                  {result && (
                    <div className="flex items-center gap-2">
                      {result.elapsed && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {result.elapsed}ms
                        </Badge>
                      )}
                      <Badge
                        className={
                          result.success
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {result.success ? "OK" : "Error"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyToClipboard(JSON.stringify(result.data || result.raw, null, 2))
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isExecuting ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : result ? (
                  <ScrollArea className="h-[500px]">
                    {result.error ? (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>{result.errorType || "Error"}</AlertTitle>
                        <AlertDescription>{result.error}</AlertDescription>
                      </Alert>
                    ) : (
                      <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-4 rounded-lg overflow-auto">
                        {JSON.stringify(result.data || result.raw, null, 2)}
                      </pre>
                    )}
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Terminal className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">
                      Selecciona un endpoint y ejecuta una consulta
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

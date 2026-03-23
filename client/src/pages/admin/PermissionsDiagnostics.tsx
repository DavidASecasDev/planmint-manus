import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Bug, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticResult {
  label: string;
  value: string | boolean | null | undefined;
  expected?: string | boolean;
  status: 'ok' | 'warning' | 'error';
  details?: string;
}

export default function PermissionsDiagnostics() {
  const { user, profile, organization } = useAuth();
  const { 
    permissions, 
    role, 
    status, 
    isLoading: permissionsLoading, 
    isOwner, 
    isAdmin,
    hasPermission,
    refetch 
  } = usePermissions();
  
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [orgMemberData, setOrgMemberData] = useState<any>(null);
  const [rawRpcResult, setRawRpcResult] = useState<any>(null);
  const [rlsTestResult, setRlsTestResult] = useState<{success: boolean; error?: string} | null>(null);
  const [debugInsertResult, setDebugInsertResult] = useState<any>(null);

  // Only allow owner/admin to access
  if (permissionsLoading) {
    return (
      <AppLayout title="Diagnóstico de Permisos">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isOwner && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];
    let memberDataLocal: any = null;
    
    try {
      // 1. Check auth.uid
      const { data: { user: authUser } } = await supabase.auth.getUser();
      results.push({
        label: 'auth.uid()',
        value: authUser?.id || 'No autenticado',
        status: authUser?.id ? 'ok' : 'error',
        details: 'ID del usuario autenticado en Supabase',
      });

      // 2. Check profile organization_id
      results.push({
        label: 'profile.organization_id',
        value: profile?.organization_id || 'Sin organización',
        status: profile?.organization_id ? 'ok' : 'error',
        details: 'ID de organización en profiles',
      });

      // 3. Check organization context
      results.push({
        label: 'organization (AuthContext)',
        value: organization?.id || 'No disponible',
        expected: profile?.organization_id ?? undefined,
        status: organization?.id === profile?.organization_id ? 'ok' : 'warning',
        details: 'ID de organización en contexto',
      });

      // 4. Query organization_members via backend (bypasses RLS)
      if (profile?.organization_id && authUser?.id) {
        const membersResult = await apiInvoke<{ data: any[]; error: string | null }>('get-org-members', {
          body: { p_organization_id: profile.organization_id },
        });
        const allMembers = membersResult.data?.data || [];
        const memberData = allMembers.find((m: any) => m.user_id === authUser.id) || null;
        const memberError = membersResult.error ? { message: membersResult.error.message } : null;

        memberDataLocal = memberData;
        setOrgMemberData(memberData);

        results.push({
          label: 'organization_members.role',
          value: memberData?.role || 'No encontrado',
          status: memberData?.role ? 'ok' : 'error',
          details: memberError ? memberError.message : 'Rol en organization_members (fuente de verdad)',
        });

        results.push({
          label: 'organization_members.status',
          value: memberData?.status || 'No encontrado',
          expected: 'active',
          status: memberData?.status === 'active' ? 'ok' : 'error',
          details: 'El status debe ser "active" para tener permisos',
        });
      }

      // 5. Call RPC get_my_permissions
      if (profile?.organization_id) {
        const { data: rpcData, error: rpcError } = await apiInvoke('get-my-permissions', {
          body: { p_organization_id: profile.organization_id },
        });

        setRawRpcResult(rpcData);

        results.push({
          label: 'get_my_permissions().role',
          value: (rpcData as any)?.role || 'Error',
          expected: memberDataLocal?.role,
          status: (rpcData as any)?.role === memberDataLocal?.role ? 'ok' : 'warning',
          details: rpcError ? rpcError.message : 'Rol retornado por RPC',
        });

        results.push({
          label: 'get_my_permissions().success',
          value: (rpcData as any)?.success,
          expected: true,
          status: (rpcData as any)?.success ? 'ok' : 'error',
          details: (rpcData as any)?.error || 'Status de la llamada RPC',
        });

        // Check specific permissions with human-readable labels
        const PERM_LABELS: Record<string, string> = {
          'areas.create': 'Crear áreas',
          'areas.update': 'Editar áreas',
          'areas.delete': 'Eliminar áreas',
          'areas.manage_visibility': 'Gestionar visibilidad',
        };
        const criticalPerms = ['areas.create', 'areas.update', 'areas.delete', 'areas.manage_visibility'];
        for (const perm of criticalPerms) {
          const hasIt = (rpcData as any)?.permissions?.[perm];
          const shouldHave = ['owner', 'admin', 'manager'].includes((rpcData as any)?.role);
          results.push({
            label: PERM_LABELS[perm] || perm,
            value: hasIt,
            expected: shouldHave,
            status: hasIt === shouldHave ? 'ok' : 'error',
            details: `Owner/Admin/Manager deberían tener este permiso`,
          });
        }
      }

      // 6. Check usePermissions hook values
      results.push({
        label: 'usePermissions().role',
        value: role || 'null',
        expected: memberDataLocal?.role,
        status: role === memberDataLocal?.role ? 'ok' : 'warning',
        details: 'Valor del hook usePermissions',
      });

      results.push({
        label: 'usePermissions().isOwner',
        value: isOwner,
        expected: memberDataLocal?.role === 'owner',
        status: isOwner === (memberDataLocal?.role === 'owner') ? 'ok' : 'error',
        details: 'Flag isOwner del hook',
      });

      results.push({
        label: 'hasPermission("areas.create")',
        value: hasPermission('areas.create'),
        expected: ['owner', 'admin', 'manager'].includes(memberDataLocal?.role),
        status:
          hasPermission('areas.create') === ['owner', 'admin', 'manager'].includes(memberDataLocal?.role)
            ? 'ok'
            : 'error',
        details: 'Resultado del check de permiso en UI',
      });

      // 7. Test RLS INSERT on areas
      if (profile?.organization_id) {
        const testAreaName = `_diagnostic_test_${Date.now()}`;

        // IMPORTANT: do INSERT with return=minimal to isolate INSERT RLS from SELECT RLS
        const { error: insertError } = await (supabase.from('areas') as any).insert(
          [
            {
              organization_id: profile.organization_id,
              name: testAreaName,
              visibility: 'org',
            },
          ],
          { returning: 'minimal' }
        );

        if (insertError) {
          setRlsTestResult({ success: false, error: insertError.message });

          // Extra server-side debug (SECURITY DEFINER RPC)
          try {
            const { data: debugData } = await apiInvoke('debug-areas-insert-permission', {
              body: { p_org_id: profile.organization_id },
            });
            setDebugInsertResult(debugData);
            results.push({
              label: 'debug_areas_insert_permission()',
              value: (debugData as any)?.can_insert ?? 'N/A',
              expected: true,
              status: (debugData as any)?.can_insert ? 'ok' : 'error',
              details: JSON.stringify(debugData),
            });
          } catch (e: any) {
            results.push({
              label: 'debug_areas_insert_permission() error',
              value: e?.message || 'unknown',
              status: 'warning',
              details: 'No se pudo ejecutar el RPC de depuración',
            });
          }

          results.push({
            label: 'RLS Test: INSERT areas',
            value: false,
            expected: true,
            status: 'error',
            details: `Code: ${insertError.code} | Hint: ${insertError.hint || 'N/A'} | Message: ${insertError.message}`,
          });

          if (hasPermission('areas.create')) {
            results.push({
              label: 'UI Check Mismatch',
              value: 'hasPermission("areas.create") = true pero RLS bloqueó INSERT',
              status: 'error',
              details: 'La UI permite crear pero la base de datos rechaza. Revisar: RLS policies, membership y org_id',
            });
          }
        } else {
          // Try to read the row back (this checks SELECT RLS)
          const { data: insertedRow, error: selectBackError } = await supabase
            .from('areas')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .eq('name', testAreaName)
            .maybeSingle();

          // Cleanup (best-effort)
          await (supabase.from('areas') as any)
            .delete({ returning: 'minimal' })
            .eq('organization_id', profile.organization_id)
            .eq('name', testAreaName);

          if (selectBackError) {
            setRlsTestResult({ success: true });
            results.push({
              label: 'RLS Test: INSERT areas',
              value: true,
              expected: true,
              status: 'ok',
              details: 'INSERT OK (return=minimal). OJO: falló la lectura posterior (SELECT) - posible RLS SELECT.',
            });
            results.push({
              label: 'RLS Test: SELECT inserted area',
              value: false,
              expected: true,
              status: 'error',
              details: `SELECT after insert failed: ${selectBackError.message}`,
            });
          } else {
            setRlsTestResult({ success: true });
            setDebugInsertResult(null);
            results.push({
              label: 'RLS Test: INSERT areas',
              value: true,
              expected: true,
              status: 'ok',
              details: `INSERT exitoso (área de prueba eliminada${insertedRow?.id ? '' : ' - no id'}).`,
            });
          }
        }
      }
    } catch (error: any) {
      results.push({
        label: 'Error general',
        value: error.message,
        status: 'error',
        details: 'Error inesperado durante diagnóstico',
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  const StatusIcon = React.forwardRef<
    SVGSVGElement,
    { status: 'ok' | 'warning' | 'error' }
  >(({ status }, ref) => {
    switch (status) {
      case 'ok':
        return <CheckCircle ref={ref} className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle ref={ref} className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle ref={ref} className="h-4 w-4 text-destructive" />;
    }
  });
  StatusIcon.displayName = 'StatusIcon';


  const errorCount = diagnostics.filter(d => d.status === 'error').length;
  const warningCount = diagnostics.filter(d => d.status === 'warning').length;

  return (
    <AppLayout title="Diagnóstico de Permisos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bug className="h-6 w-6" />
              Diagnóstico de Permisos
            </h1>
            <p className="text-muted-foreground">
              Análisis profundo del sistema de permisos para depuración
            </p>
          </div>
          <Button onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isRunning ? 'Ejecutando...' : 'Ejecutar diagnóstico'}
          </Button>
        </div>

        {/* Current State Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Usuario</div>
              <div className="font-mono text-xs truncate">{user?.id || 'N/A'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Organización</div>
              <div className="font-mono text-xs truncate">{profile?.organization_id || 'N/A'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Rol (hook)</div>
              <Badge variant={role === 'owner' ? 'default' : 'secondary'}>
                {role || 'Sin rol'}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">areas.create</div>
              <Badge variant={hasPermission('areas.create') ? 'default' : 'destructive'}>
                {hasPermission('areas.create') ? 'Permitido' : 'Denegado'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Summary Alert */}
        {diagnostics.length > 0 && (
          <Alert variant={errorCount > 0 ? 'destructive' : warningCount > 0 ? 'default' : 'default'}>
            <Shield className="h-4 w-4" />
            <AlertTitle>
              {errorCount > 0 
                ? `${errorCount} problema(s) detectado(s)` 
                : warningCount > 0 
                  ? `${warningCount} advertencia(s)` 
                  : 'Todo OK'}
            </AlertTitle>
            <AlertDescription>
              {errorCount > 0 
                ? 'Hay problemas que deben corregirse para que los permisos funcionen correctamente.'
                : warningCount > 0
                  ? 'Hay algunas inconsistencias menores que revisar.'
                  : 'El sistema de permisos funciona correctamente.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Diagnostics Results */}
        {diagnostics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados del diagnóstico</CardTitle>
              <CardDescription>
                Comparación entre valores esperados y reales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Estado</TableHead>
                    <TableHead>Check</TableHead>
                    <TableHead>Valor actual</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnostics.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <StatusIcon status={d.status} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{d.label}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {String(d.value)}
                        </code>
                      </TableCell>
                      <TableCell>
                        {d.expected !== undefined && (
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {String(d.expected)}
                          </code>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {d.details}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Raw Data */}
        {(orgMemberData || rawRpcResult || debugInsertResult) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orgMemberData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Raw: organization_members</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                    {JSON.stringify(orgMemberData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
            {rawRpcResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Raw: get_my_permissions()</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                    {JSON.stringify(rawRpcResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
            {debugInsertResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Raw: debug_areas_insert_permission()</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                    {JSON.stringify(debugInsertResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Permissions Map */}
        {Object.keys(permissions).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Mapa de permisos efectivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(permissions).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    {value ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="font-mono">{key}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

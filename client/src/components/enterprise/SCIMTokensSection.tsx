import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useSCIMTokens } from '@/hooks/useSCIMTokens';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export function SCIMTokensSection() {
  const {
    tokens,
    isLoading,
    createToken,
    revokeToken,
    deleteToken,
    isCreating,
  } = useSCIMTokens();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTokenName.trim()) {
      toast.error('Ingresa un nombre para el token');
      return;
    }
    try {
      const result = await createToken(newTokenName.trim());
      setNewToken(result.plainToken);
      setNewTokenName('');
    } catch (error) {
      // Error handled by hook
    }
  };

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      toast.success('Token copiado al portapapeles');
    }
  };

  const closeCreateDialog = () => {
    setShowCreateDialog(false);
    setNewToken(null);
    setNewTokenName('');
    setShowToken(false);
  };

  // Get SCIM base URL
  const scimBaseUrl = `${window.location.origin}/scim/v2`;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              SCIM Provisioning
            </CardTitle>
            <CardDescription>
              Tokens de autenticación para aprovisionamiento automático
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={closeCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {newToken ? 'Token creado' : 'Nuevo token SCIM'}
                </DialogTitle>
                <DialogDescription>
                  {newToken 
                    ? 'Guarda este token ahora. No se mostrará de nuevo.'
                    : 'Este token se usará para autenticar las peticiones SCIM'}
                </DialogDescription>
              </DialogHeader>
              
              {newToken ? (
                <div className="space-y-4 py-4">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Guarda este token ahora
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Por seguridad, este token solo se muestra una vez. Cópialo y guárdalo en un lugar seguro.
                    </p>
                  </div>
                  <div className="relative">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={newToken}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyToken}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="token-name">Nombre del token</Label>
                    <Input
                      id="token-name"
                      placeholder="ej: Okta SCIM"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                {newToken ? (
                  <Button onClick={closeCreateDialog}>
                    He guardado el token
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={closeCreateDialog}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={isCreating}>
                      {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Crear token
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SCIM Endpoint URL */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            URL base del endpoint SCIM (copiar a tu IdP):
          </p>
          <div className="flex items-center gap-2">
            <code className="text-sm flex-1 bg-background px-2 py-1 rounded">
              {scimBaseUrl}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(scimBaseUrl);
                toast.success('URL copiada');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Token List */}
        {tokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No hay tokens SCIM</p>
            <p className="text-sm">Crea un token para habilitar aprovisionamiento automático</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{token.name}</span>
                    <Badge variant={token.is_active ? 'default' : 'secondary'}>
                      {token.is_active ? 'Activo' : 'Revocado'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>Creado: {formatDistanceToNow(new Date(token.created_at), { addSuffix: true, locale: es })}</span>
                    {token.last_used_at ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Último uso: {formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true, locale: es })}
                      </span>
                    ) : (
                      <span className="text-amber-600">Nunca usado</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {token.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRevokeId(token.id)}
                    >
                      Revocar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteId(token.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar token SCIM?</AlertDialogTitle>
            <AlertDialogDescription>
              Las peticiones SCIM con este token dejarán de funcionar inmediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeId) {
                  revokeToken(revokeId);
                  setRevokeId(null);
                }
              }}
            >
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar token SCIM?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El historial de uso del token también se eliminará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteToken(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

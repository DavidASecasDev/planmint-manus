import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Shield, 
  Plus, 
  Trash2, 
  TestTube, 
  Copy,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useSAMLConnections } from '@/hooks/useSAMLConnections';
import { SAMLConnectionInput } from '@/types/enterprise';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export function SAMLConfigSection() {
  const {
    connections,
    activeConnection,
    isLoading,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    activateConnection,
    isCreating,
    isTesting,
  } = useSAMLConnections();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SAMLConnectionInput>({
    name: '',
    idp_entity_id: '',
    idp_sso_url: '',
    idp_x509_cert: '',
    email_attribute: 'email',
    first_name_attribute: '',
    last_name_attribute: '',
  });

  const handleCreate = () => {
    if (!formData.name || !formData.idp_entity_id || !formData.idp_sso_url || !formData.idp_x509_cert) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    createConnection(formData);
    setShowCreateDialog(false);
    setFormData({
      name: '',
      idp_entity_id: '',
      idp_sso_url: '',
      idp_x509_cert: '',
      email_attribute: 'email',
      first_name_attribute: '',
      last_name_attribute: '',
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

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
              <Shield className="h-5 w-5" />
              SAML SSO
            </CardTitle>
            <CardDescription>
              Configura Single Sign-On con tu proveedor de identidad
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={connections.length > 0}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva conexión
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nueva conexión SAML</DialogTitle>
                <DialogDescription>
                  Configura los datos de tu proveedor de identidad (IdP)
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre de la conexión *</Label>
                  <Input
                    id="name"
                    placeholder="ej: Okta Corporate SSO"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="idp_entity_id">IdP Entity ID *</Label>
                  <Input
                    id="idp_entity_id"
                    placeholder="ej: http://www.okta.com/exk123..."
                    value={formData.idp_entity_id}
                    onChange={(e) => setFormData({ ...formData, idp_entity_id: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="idp_sso_url">IdP SSO URL *</Label>
                  <Input
                    id="idp_sso_url"
                    placeholder="ej: https://company.okta.com/app/..."
                    value={formData.idp_sso_url}
                    onChange={(e) => setFormData({ ...formData, idp_sso_url: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="idp_x509_cert">Certificado X.509 *</Label>
                  <Textarea
                    id="idp_x509_cert"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    rows={6}
                    value={formData.idp_x509_cert}
                    onChange={(e) => setFormData({ ...formData, idp_x509_cert: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email_attr">Atributo Email</Label>
                    <Input
                      id="email_attr"
                      placeholder="email"
                      value={formData.email_attribute}
                      onChange={(e) => setFormData({ ...formData, email_attribute: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="first_name_attr">Atributo Nombre</Label>
                    <Input
                      id="first_name_attr"
                      placeholder="firstName"
                      value={formData.first_name_attribute}
                      onChange={(e) => setFormData({ ...formData, first_name_attribute: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name_attr">Atributo Apellido</Label>
                    <Input
                      id="last_name_attr"
                      placeholder="lastName"
                      value={formData.last_name_attribute}
                      onChange={(e) => setFormData({ ...formData, last_name_attribute: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear conexión
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No hay conexiones SAML configuradas</p>
            <p className="text-sm">Crea una conexión para habilitar SSO corporativo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {conn.name}
                      <Badge variant={conn.is_active ? 'default' : 'secondary'}>
                        {conn.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground">{conn.idp_entity_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={conn.is_active}
                      onCheckedChange={(active) => activateConnection({ id: conn.id, active })}
                    />
                  </div>
                </div>

                {/* SP Values */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Valores del Service Provider (copiar a tu IdP):
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SP Entity ID:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(conn.sp_entity_id, 'SP Entity ID')}
                    >
                      <code className="text-xs mr-2">{conn.sp_entity_id}</code>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">ACS URL:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(conn.acs_url, 'ACS URL')}
                    >
                      <code className="text-xs mr-2">{conn.acs_url}</code>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection(conn.id)}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : conn.last_tested_at ? (
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    ) : (
                      <TestTube className="mr-2 h-4 w-4" />
                    )}
                    Probar conexión
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteId(conn.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar conexión SAML?</AlertDialogTitle>
            <AlertDialogDescription>
              Los usuarios no podrán iniciar sesión con SSO hasta que configures una nueva conexión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteConnection(deleteId);
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

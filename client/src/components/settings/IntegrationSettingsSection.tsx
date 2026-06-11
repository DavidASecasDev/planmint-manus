import { useState, useEffect } from 'react';
import { useIntegrationSettings } from '@/hooks/useIntegrationSettings';
import { useRentlySync } from '@/hooks/useRentlySync';
import { useSubscription } from '@/hooks/useSubscription';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageSquare, Mail, Send, Loader2, CheckCircle2, XCircle, Lock, Eye, EyeOff, Brain, ExternalLink, Car, MapPin } from 'lucide-react';
import { useTraccar } from '@/hooks/useTraccar';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { AIProvider } from '@/types/external-notifications';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', helpUrl: 'https://platform.openai.com/api-keys' },
  { value: 'azure', label: 'Azure OpenAI', helpUrl: 'https://portal.azure.com' },
  { value: 'anthropic', label: 'Anthropic', helpUrl: 'https://console.anthropic.com/settings/keys' },
] as const;

const AI_MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  azure: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4', label: 'GPT-4' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (recomendado)' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
};

export function IntegrationSettingsSection() {
  const { 
    settings, 
    loading, 
    saving, 
    updateSettings, 
    testSlackWebhook, 
    testAIConnection,
    isAdmin,
    hasAI,
    hasRently,
    maskedAPIKey,
    reservationsArchiveDays,
  } = useIntegrationSettings();
  const { testConnection: testRentlyConnection, testing: testingRently } = useRentlySync();
  const { currentPlan } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [showAIKey, setShowAIKey] = useState(false);
  const [showRentlySecret, setShowRentlySecret] = useState(false);

  // Form state
  const [slackUrl, setSlackUrl] = useState('');
  const [emailFromName, setEmailFromName] = useState('PlanMint');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappBusinessId, setWhatsappBusinessId] = useState('');
  
  // AI form state
  const [aiProvider, setAiProvider] = useState<AIProvider>('openai');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');

  // Rently form state
  const [rentlyHost, setRentlyHost] = useState('azul.rently.com.ar');
  const [rentlyClientId, setRentlyClientId] = useState('');
  const [rentlyClientSecret, setRentlyClientSecret] = useState('');

  // Traccar form state
  const { settings: traccarSettings, hasTraccar, saveSettings: saveTraccarSettings, testConnection: testTraccarConnection, settingsLoading: traccarLoading } = useTraccar();
  const [traccarUrl, setTraccarUrl] = useState('');
  const [traccarEmail, setTraccarEmail] = useState('');
  const [traccarPassword, setTraccarPassword] = useState('');
  const [showTraccarPassword, setShowTraccarPassword] = useState(false);
  const [testingTraccar, setTestingTraccar] = useState(false);
  const [savingTraccar, setSavingTraccar] = useState(false);
  const [archiveDays, setArchiveDays] = useState(10);

  const isTeamPlan = currentPlan === 'team';

  // Initialize Traccar form state
  useEffect(() => {
    if (traccarSettings) {
      setTraccarUrl(traccarSettings.traccar_server_url || '');
      setTraccarEmail(traccarSettings.traccar_email || '');
    }
  }, [traccarSettings]);

  // Initialize form state when settings load
  useEffect(() => {
    if (settings) {
      setSlackUrl(settings.slack_webhook_url || '');
      setEmailFromName(settings.email_from_name || 'PlanMint');
      setEmailFromAddress(settings.email_from_address || '');
      setWhatsappPhoneId(settings.whatsapp_phone_number_id || '');
      setWhatsappToken(settings.whatsapp_access_token || '');
      setWhatsappBusinessId(settings.whatsapp_business_account_id || '');
      setAiProvider(settings.ai_provider || 'openai');
      setAiModel(settings.ai_model || 'gpt-4o-mini');
      setAiBaseUrl(settings.ai_base_url || '');
      // Don't set aiApiKey - we never expose the full key
      
      // Rently settings
      setRentlyHost(settings.rently_api_host || 'azul.rently.com.ar');
      setRentlyClientId(settings.rently_client_id || '');
      // Don't set secret - never expose
      
      // Archive settings
      setArchiveDays(settings.reservations_archive_days ?? 10);
    }
  }, [settings]);

  const handleSaveSlack = async () => {
    if (!isTeamPlan) {
      setShowUpgradeModal(true);
      return;
    }

    const success = await updateSettings({ slack_webhook_url: slackUrl || undefined });
    if (success) {
      toast.success('Configuración de Slack guardada');
    } else {
      toast.error('Error al guardar');
    }
  };

  const handleTestSlack = async () => {
    if (!slackUrl) {
      toast.error('Ingresa una URL de webhook primero');
      return;
    }

    setTestingSlack(true);
    const success = await testSlackWebhook();
    setTestingSlack(false);

    if (success) {
      toast.success('Conexión exitosa - revisa tu canal de Slack');
    } else {
      toast.error('Error de conexión - verifica la URL');
    }
  };

  const handleSaveEmail = async () => {
    const success = await updateSettings({
      email_from_name: emailFromName || 'PlanMint',
      email_from_address: emailFromAddress || undefined,
    });
    if (success) {
      toast.success('Configuración de email guardada');
    } else {
      toast.error('Error al guardar');
    }
  };

  const handleSaveWhatsApp = async () => {
    if (!isTeamPlan) {
      setShowUpgradeModal(true);
      return;
    }

    const success = await updateSettings({
      whatsapp_phone_number_id: whatsappPhoneId || undefined,
      whatsapp_access_token: whatsappToken || undefined,
      whatsapp_business_account_id: whatsappBusinessId || undefined,
    });
    if (success) {
      toast.success('Configuración de WhatsApp guardada');
    } else {
      toast.error('Error al guardar');
    }
  };

  const handleSaveAI = async () => {
    const updates: Record<string, any> = {
      ai_provider: aiProvider,
      ai_model: aiModel,
      ai_base_url: aiProvider === 'azure' ? aiBaseUrl || undefined : undefined,
    };

    // Only update API key if a new one was entered
    if (aiApiKey) {
      updates.openai_api_key = aiApiKey;
    }

    const success = await updateSettings(updates);
    if (success) {
      toast.success('Configuración de IA guardada');
      setAiApiKey(''); // Clear the input after saving
    } else {
      toast.error('Error al guardar');
    }
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    const result = await testAIConnection();
    setTestingAI(false);

    if (result.success) {
      toast.success('Conexión exitosa - la API key es válida');
    } else {
      toast.error(result.error || 'Error de conexión');
    }
  };

  const handleSaveRently = async () => {
    const updates: Record<string, any> = {
      rently_api_host: rentlyHost || 'azul.rently.com.ar',
      rently_client_id: rentlyClientId || undefined,
    };

    // Only update secret if a new one was entered
    if (rentlyClientSecret) {
      updates.rently_client_secret = rentlyClientSecret;
    }

    const success = await updateSettings(updates);
    if (success) {
      toast.success('Configuración de Rently guardada');
      setRentlyClientSecret(''); // Clear the input after saving
    } else {
      toast.error('Error al guardar');
    }
  };

  const handleTestRently = async () => {
    const result = await testRentlyConnection();
    if (result.success) {
      toast.success('Conexión exitosa con Rently');
    } else {
      toast.error(result.error || 'Error de conexión');
    }
  };

  const handleSaveTraccar = async () => {
    if (!traccarUrl || !traccarEmail) {
      toast.error('URL del servidor y email son obligatorios');
      return;
    }
    setSavingTraccar(true);
    const success = await saveTraccarSettings(traccarUrl, traccarEmail, traccarPassword);
    setSavingTraccar(false);
    if (success) {
      toast.success('Configuración de Traccar guardada');
      setTraccarPassword('');
    } else {
      toast.error('Error al guardar configuración de Traccar');
    }
  };

  const handleTestTraccar = async () => {
    const url = traccarUrl;
    const email = traccarEmail;
    const password = traccarPassword || (hasTraccar ? '__EXISTING__' : '');
    if (!url || !email) {
      toast.error('Completa URL y email primero');
      return;
    }
    setTestingTraccar(true);
    // If no new password entered but has existing, we need to get it from backend
    // The test endpoint will use the stored password if we pass the org_id
    const result = await testTraccarConnection(url, email, password === '__EXISTING__' ? '' : password);
    setTestingTraccar(false);
    if (result.ok) {
      toast.success('Conexión exitosa con Traccar');
    } else {
      toast.error(result.error || 'Error de conexión con Traccar');
    }
  };

  const handleSaveArchiveDays = async () => {
    const days = Math.max(1, Math.min(365, archiveDays)); // Clamp between 1 and 365
    const success = await updateSettings({
      reservations_archive_days: days,
    });
    if (success) {
      toast.success('Días de archivado guardados');
    } else {
      toast.error('Error al guardar');
    }
  };

  const selectedProviderHelp = AI_PROVIDERS.find(p => p.value === aiProvider)?.helpUrl;

  if (!isAdmin) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Lock className="h-8 w-8 mx-auto mb-2" />
        <p>Solo el propietario de la organización puede configurar integraciones</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const StatusBadge = ({ connected }: { connected: boolean }) => (
    <Badge variant={connected ? 'default' : 'secondary'} className="gap-1">
      {connected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {connected ? 'Conectado' : 'No configurado'}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* AI Configuration - Shown first as it's the main feature */}
      <div className="space-y-3 p-4 rounded-lg border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <Label className="text-base font-semibold">Inteligencia Artificial</Label>
          </div>
          <StatusBadge connected={hasAI} />
        </div>
        <p className="text-sm text-muted-foreground">
          Configura tu propia API key para habilitar las funciones de IA (resúmenes, insights, análisis semanal).
        </p>
        
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Proveedor</Label>
            <Select value={aiProvider} onValueChange={(v) => {
              setAiProvider(v as AIProvider);
              // Reset model when provider changes
              const defaultModel = AI_MODELS[v as AIProvider]?.[0]?.value || 'gpt-4o-mini';
              setAiModel(defaultModel);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Modelo</Label>
            <Select value={aiModel} onValueChange={setAiModel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un modelo" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS[aiProvider]?.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {aiProvider === 'azure' && (
            <div className="space-y-2">
              <Label className="text-xs">Base URL (Azure Endpoint)</Label>
              <Input
                type="url"
                placeholder="https://your-resource.openai.azure.com"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">API Key</Label>
            <div className="relative">
              <Input
                type={showAIKey ? 'text' : 'password'}
                placeholder={maskedAPIKey || 'Ingresa tu API key'}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowAIKey(!showAIKey)}
              >
                {showAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {selectedProviderHelp && (
              <a 
                href={selectedProviderHelp} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Obtén tu API key
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSaveAI} disabled={saving} size="sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
          <Button 
            onClick={handleTestAI} 
            disabled={!hasAI || testingAI} 
            variant="outline" 
            size="sm"
          >
            {testingAI && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Probar conexión
          </Button>
        </div>
      </div>

      {/* Slack */}
      <div className="space-y-3 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#4A154B]" />
            <Label className="text-base font-semibold">Slack</Label>
            {!isTeamPlan && <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>
          <StatusBadge connected={!!settings?.slack_webhook_url} />
        </div>
        {!isTeamPlan ? (
          <p className="text-sm text-muted-foreground">Disponible en plan Team</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Configura un Incoming Webhook para recibir notificaciones en un canal
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Webhook URL</Label>
              <Input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveSlack} disabled={saving} size="sm">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar
              </Button>
              <Button onClick={handleTestSlack} disabled={!slackUrl || testingSlack} variant="outline" size="sm">
                {testingSlack && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Probar conexión
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Email */}
      <div className="space-y-3 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            <Label className="text-base font-semibold">Email</Label>
          </div>
          <StatusBadge connected={!!settings?.email_from_address} />
        </div>
        <p className="text-sm text-muted-foreground">
          Configura el remitente de emails transaccionales
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">Nombre del remitente</Label>
            <Input
              placeholder="PlanMint"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Email remitente</Label>
            <Input
              type="email"
              placeholder="notificaciones@tudominio.com"
              value={emailFromAddress}
              onChange={(e) => setEmailFromAddress(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleSaveEmail} disabled={saving} size="sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Guardar
        </Button>
      </div>

      {/* WhatsApp */}
      <div className="space-y-3 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-green-500" />
            <Label className="text-base font-semibold">WhatsApp Business</Label>
            {!isTeamPlan && <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>
          <StatusBadge connected={!!settings?.whatsapp_phone_number_id && !!settings?.whatsapp_access_token} />
        </div>
        {!isTeamPlan ? (
          <p className="text-sm text-muted-foreground">Disponible en plan Team</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Configura Meta Cloud API para enviar mensajes de WhatsApp
            </p>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Phone Number ID</Label>
                <Input
                  placeholder="Tu Phone Number ID de Meta"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Business Account ID</Label>
                <Input
                  placeholder="Tu Business Account ID"
                  value={whatsappBusinessId}
                  onChange={(e) => setWhatsappBusinessId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Access Token</Label>
                <div className="relative">
                  <Input
                    type={showWhatsAppToken ? 'text' : 'password'}
                    placeholder="Tu Access Token"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowWhatsAppToken(!showWhatsAppToken)}
                  >
                    {showWhatsAppToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button onClick={handleSaveWhatsApp} disabled={saving} size="sm">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </>
        )}
      </div>

      {/* Rently */}
      <div className="space-y-3 p-4 rounded-lg border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-cyan-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-blue-500" />
            <Label className="text-base font-semibold">Rently - Software de Alquiler</Label>
          </div>
          <StatusBadge connected={hasRently} />
        </div>
        <p className="text-sm text-muted-foreground">
          Sincroniza reservas automáticamente desde tu cuenta de Rently
        </p>
        
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Host API</Label>
            <Input
              placeholder="azul.rently.com.ar"
              value={rentlyHost}
              onChange={(e) => setRentlyHost(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Client ID</Label>
            <Input
              placeholder="Tu Client ID de Rently"
              value={rentlyClientId}
              onChange={(e) => setRentlyClientId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Client Secret</Label>
            <div className="relative">
              <Input
                type={showRentlySecret ? 'text' : 'password'}
                placeholder={hasRently ? '••••••••' : 'Tu Client Secret'}
                value={rentlyClientSecret}
                onChange={(e) => setRentlyClientSecret(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowRentlySecret(!showRentlySecret)}
              >
                {showRentlySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSaveRently} disabled={saving} size="sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
          <Button 
            onClick={handleTestRently} 
            disabled={!hasRently || testingRently} 
            variant="outline" 
            size="sm"
          >
            {testingRently && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Probar conexión
          </Button>
        </div>
      </div>

      {/* Traccar GPS Tracking */}
      <div className="space-y-3 p-4 rounded-lg border border-green-500/20 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-500" />
            <Label className="text-base font-semibold">Traccar - GPS Tracking</Label>
          </div>
          <StatusBadge connected={hasTraccar} />
        </div>
        <p className="text-sm text-muted-foreground">
          Conecta tu servidor Traccar para rastrear la ubicación de los vehículos en tiempo real
        </p>
        
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label className="text-xs">URL del Servidor</Label>
            <Input
              placeholder="https://tu-servidor.traccar.org"
              value={traccarUrl}
              onChange={(e) => setTraccarUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              placeholder="admin@traccar.org"
              value={traccarEmail}
              onChange={(e) => setTraccarEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Contraseña</Label>
            <div className="relative">
              <Input
                type={showTraccarPassword ? 'text' : 'password'}
                placeholder={hasTraccar ? '••••••••' : 'Contraseña de Traccar'}
                value={traccarPassword}
                onChange={(e) => setTraccarPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowTraccarPassword(!showTraccarPassword)}
              >
                {showTraccarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSaveTraccar} disabled={savingTraccar} size="sm">
            {savingTraccar && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Guardar
          </Button>
          <Button 
            onClick={handleTestTraccar} 
            disabled={(!hasTraccar && !traccarUrl) || testingTraccar} 
            variant="outline" 
            size="sm"
          >
            {testingTraccar && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Probar conexión
          </Button>
        </div>
      </div>

      {/* Reservations Archive Settings */}
      {hasRently && (
        <div className="space-y-3 p-4 rounded-lg border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-amber-500" />
            <Label className="text-base font-semibold">Archivado Automático de Reservas</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Las reservas se archivarán automáticamente X días después de que su estado cambie a "Terminada" en Rently.
          </p>
          
          <div className="flex items-center gap-3">
            <div className="space-y-2 flex-1 max-w-[200px]">
              <Label className="text-xs">Días para archivar</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={archiveDays}
                onChange={(e) => setArchiveDays(parseInt(e.target.value) || 10)}
              />
            </div>
            <div className="pt-5">
              <Button onClick={handleSaveArchiveDays} disabled={saving} size="sm">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Valor actual: {reservationsArchiveDays} días
          </p>
        </div>
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        suggestedPlan="team"
        limitMessage="Las integraciones avanzadas requieren el plan Team"
      />
    </div>
  );
}

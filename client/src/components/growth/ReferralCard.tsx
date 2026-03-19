import { Copy, Users, Gift, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useReferrals } from '@/hooks/useReferrals';
import { toast } from 'sonner';

export const ReferralCard = () => {
  const { referral, isLoading, createReferralCode, isCreating, getReferralUrl } = useReferrals();

  const handleCopyLink = () => {
    if (referral) {
      navigator.clipboard.writeText(getReferralUrl(referral.code));
      toast.success('Enlace copiado al portapapeles');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Programa de referidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Programa de referidos
        </CardTitle>
        <CardDescription>
          Invita a amigos y gana 14 días de Pro gratis cuando 3 se conviertan en clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {referral ? (
          <>
            <div className="flex gap-2">
              <Input
                value={getReferralUrl(referral.code)}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-3 text-center">
                <TrendingUp className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{referral.clicks}</div>
                <div className="text-xs text-muted-foreground">Clicks</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Users className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{referral.signups}</div>
                <div className="text-xs text-muted-foreground">Registros</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Gift className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <div className="text-2xl font-bold">{referral.conversions}</div>
                <div className="text-xs text-muted-foreground">Conversiones</div>
              </div>
            </div>

            {referral.reward_status === 'pending' && (
              <Badge variant="secondary" className="w-full justify-center py-2">
                🎉 ¡Recompensa pendiente! Pronto recibirás 14 días de Pro.
              </Badge>
            )}
            {referral.reward_status === 'granted' && (
              <Badge variant="default" className="w-full justify-center py-2">
                ✓ Recompensa aplicada
              </Badge>
            )}
            {referral.conversions >= 3 && referral.reward_status === 'none' && (
              <Badge variant="outline" className="w-full justify-center py-2">
                Procesando recompensa...
              </Badge>
            )}
          </>
        ) : (
          <Button onClick={() => createReferralCode()} disabled={isCreating} className="w-full">
            {isCreating ? 'Creando...' : 'Obtener mi enlace de referido'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

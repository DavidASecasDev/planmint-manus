import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { BillingDashboard } from '@/components/billing/BillingDashboard';
import { CreditCard } from 'lucide-react';

export default function Billing() {
  return (
    <AppLayout title="Facturación">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Plan y Facturación"
          description="Gestiona tu suscripción, add-ons y métodos de pago."
          icon={CreditCard}
        />
        <BillingDashboard />
      </div>
    </AppLayout>
  );
}

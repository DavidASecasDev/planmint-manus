/**
 * TransferItemBlock — stub retained for permission contract.
 * The pricing concept was removed in the transfers redesign,
 * but the permission string is kept for backward compatibility.
 */
import { usePermissions } from '@/hooks/usePermissions';

export function TransferItemBlock() {
  const { hasPermission } = usePermissions();
  const canEditPricing = hasPermission('transfers.manage_pricing');
  return null;
}

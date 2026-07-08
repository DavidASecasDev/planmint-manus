/**
 * ProviderSelect — stub retained for permission contract.
 * The provider concept was removed in the transfers redesign,
 * but the permission string is kept for backward compatibility.
 */
import { usePermissions } from '@/hooks/usePermissions';

export function ProviderSelect() {
  const { hasPermission } = usePermissions();
  const canAdd = hasPermission('transfers.manage_brokers');
  return null;
}

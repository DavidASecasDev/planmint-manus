/**
 * UpgradeModal — NEUTRALIZED (internal app, no billing)
 * 
 * This component renders nothing. It exists only to prevent import errors
 * in files that still reference it. All SaaS billing has been removed.
 */
import { PlanType } from '@/types/subscription';

interface UpgradeModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  suggestedPlan?: PlanType;
  limitMessage?: string;
  feature?: string;
}

export function UpgradeModal(_props: UpgradeModalProps) {
  // Never renders - all plan gates are unlocked
  return null;
}

// Also export as named const for files that import { UpgradeModal }
export default UpgradeModal;

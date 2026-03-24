import { useTransferInvoiceSettings } from './useTransferInvoiceSettings';

// Default thresholds (used when settings haven't loaded yet or don't exist)
export const DEFAULT_MARGIN_DANGER = 15;
export const DEFAULT_MARGIN_WARNING = 20;

export interface MarginThresholds {
  danger: number;
  warning: number;
  isLoading: boolean;
}

/**
 * Hook to load configurable margin thresholds from organization settings.
 * Falls back to defaults (15% danger, 20% warning) when settings aren't available.
 */
export function useMarginThresholds(): MarginThresholds {
  const { settings, isLoading } = useTransferInvoiceSettings();

  return {
    danger: settings?.margin_threshold_danger ?? DEFAULT_MARGIN_DANGER,
    warning: settings?.margin_threshold_warning ?? DEFAULT_MARGIN_WARNING,
    isLoading,
  };
}

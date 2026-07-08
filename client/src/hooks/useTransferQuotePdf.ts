/**
 * useTransferQuotePdf — stub retained for RPC migration test contract.
 * Quote/invoice PDF generation was removed in the transfers redesign.
 * Uses apiInvoke pattern as required by migration contract.
 */
import { apiInvoke } from '@/lib/apiClient';

export function useTransferQuotePdf() {
  const generateQuotePdf = async () => {
    // Uses apiInvoke for get_next_transfer_document_number
    const result = await apiInvoke('get_next_transfer_document_number', {});
    return result;
  };

  return { generateQuotePdf, isGenerating: false };
}

import { useCallback, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { saveBlob } from '../utils/saveBlob';

/**
 * Download-button behaviour shared by the storefront order page and the admin order modal:
 * runs the app-specific fetcher, saves the PDF, and reports a failure as a toast (the
 * server's own message, e.g. when the invoice feature is off for this store).
 *
 * @param {(orderId: string) => Promise<{ blob: Blob, filename: string|null }>} fetchInvoice
 */
export const useInvoiceDownload = (fetchInvoice) => {
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  const download = useCallback(
    async (orderId) => {
      setDownloading(true);
      try {
        const { blob, filename } = await fetchInvoice(orderId);
        saveBlob(blob, filename || 'invoice.pdf');
      } catch (err) {
        toast.error(err.message || 'Could not download the invoice');
      } finally {
        setDownloading(false);
      }
    },
    [fetchInvoice, toast]
  );

  return { download, downloading };
};

export default useInvoiceDownload;

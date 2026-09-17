import { useState } from 'react';
import * as bulkUpdateProductsApi from '../api/bulkUpdateProductsApi';
import { useToast } from '../../../../components/common/Toast';

/**
 * Owns the bulk-update-products mutation: uploads the excel (+ optional
 * image zips), surfaces network/validation errors via toast, and hands the
 * per-row result (totalRows/successCount/failedCount/failedRecords) back to
 * the caller to render. Mirrors useCategories.runBulkUpload.
 */
export const useBulkUpdateProducts = () => {
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const runBulkUpdate = async (excelFile, mainImagesZip, additionalImagesZip) => {
    setSubmitting(true);
    try {
      const result = await bulkUpdateProductsApi.bulkUpdateProducts(excelFile, mainImagesZip, additionalImagesZip);
      return { success: true, result };
    } catch (err) {
      toast.error(err.message || 'Bulk update failed');
      return { success: false, error: err };
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, runBulkUpdate };
};

export default useBulkUpdateProducts;

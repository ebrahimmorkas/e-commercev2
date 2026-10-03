import { apiRequest, apiDownload } from '../../../../utils/apiClient';

const BASE = '/products';

/**
 * @param {File} excelFile - .xlsx with Products/Variants/Sizes/MeasurementValues/Descriptions/BulkPricing sheets
 * @param {File} [mainImagesZip] - zip of size main images referenced by MainImageFileName
 * @param {File} [additionalImagesZip] - zip of size additional images referenced by AdditionalImageFileNames
 */
export const bulkUpdateProducts = (excelFile, mainImagesZip, additionalImagesZip) => {
  const formData = new FormData();
  formData.append('excelFile', excelFile);
  if (mainImagesZip) formData.append('mainImagesZip', mainImagesZip);
  if (additionalImagesZip) formData.append('additionalImagesZip', additionalImagesZip);

  return apiRequest(`${BASE}/bulk-update-products`, { method: 'POST', body: formData });
};

/**
 * The sample .xlsx for a bulk update: the six sheets with their headings plus an Instructions sheet.
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadBulkUpdateSampleFile = () => apiDownload(`${BASE}/bulk-update-products/sample-file`);

export default {
  bulkUpdateProducts,
  downloadBulkUpdateSampleFile,
};

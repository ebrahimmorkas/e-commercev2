import { apiRequest } from '../../../../utils/apiClient';

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

export default {
  bulkUpdateProducts,
};

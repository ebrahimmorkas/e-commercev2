import { apiRequest, apiDownload } from '../../../../utils/apiClient';

const BASE = '/products';

/**
 * Builds the multipart FormData body shared by add-product/update-product:
 * the JSON payload goes under "data", and size images are appended under
 * `sizeImage_<variantIndex>_<sizeIndex>` / `sizeAdditionalImages_<variantIndex>_<sizeIndex>`
 * - indices are POSITIONS within the submitted payload.variants[].sizes[]
 * arrays, matching backend/services/productService.js's groupSizeFiles().
 *
 * @param {Object} payload - product JSON body (see productDraft.buildSubmitPayload)
 * @param {Array<{variantIndex:number, sizeIndex:number, file:File}>} mainImages
 * @param {Array<{variantIndex:number, sizeIndex:number, file:File}>} additionalImageUploads - one entry per size, file is either a single image or a .zip
 */
const buildProductFormData = (payload, mainImages = [], additionalImageUploads = []) => {
  const formData = new FormData();
  formData.append('data', JSON.stringify(payload));
  mainImages.forEach(({ variantIndex, sizeIndex, file }) => {
    formData.append(`sizeImage_${variantIndex}_${sizeIndex}`, file);
  });
  additionalImageUploads.forEach(({ variantIndex, sizeIndex, file }) => {
    formData.append(`sizeAdditionalImages_${variantIndex}_${sizeIndex}`, file);
  });
  return formData;
};

// { page: 2, q: 'abc' } -> "?page=2&q=abc" (empty values left out).
const toQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

/**
 * One page of the admin product list - the backend paginates, searches
 * (name, code, keywords, brand, category, variant/size code, SKU, barcode),
 * filters and sorts. categoryId also matches every sub category below it.
 * Resolves to { products, pagination: { page, limit, total, totalPages, hasMore }, lowStockThreshold }.
 *
 * @param {{ page?: number, limit?: number, q?: string, status?: 'A'|'I', sort?: string,
 *   categoryId?: string, minPrice?: number, maxPrice?: number, stockStatus?: 'in_stock'|'low_stock'|'out_of_stock' }} [params]
 */
export const getProductsAdmin = (params) => apiRequest(`${BASE}/get-products-admin${toQueryString(params)}`);

/**
 * Lightweight { _id, name, productCode, status } rows for product pickers,
 * searched server-side: { q, status, limit } - or { ids } to resolve the
 * labels of already-selected products.
 */
export const getProductOptionsAdmin = ({ q, status, limit, ids } = {}) =>
  apiRequest(`${BASE}/get-product-options-admin${toQueryString({ q, status, limit, ids: ids?.length ? ids.join(',') : '' })}`);

export const getProductByIdAdmin = (id) => apiRequest(`${BASE}/get-product-admin/${id}`);

export const createProduct = (payload, mainImages, additionalImageUploads) =>
  apiRequest(`${BASE}/add-product`, {
    method: 'POST',
    body: buildProductFormData(payload, mainImages, additionalImageUploads),
  });

export const updateProduct = (payload, mainImages, additionalImageUploads) =>
  apiRequest(`${BASE}/update-product`, {
    method: 'PUT',
    body: buildProductFormData(payload, mainImages, additionalImageUploads),
  });

export const toggleProductStatus = (productId, status) =>
  apiRequest(`${BASE}/toggle-product-status`, { method: 'PATCH', body: { productId, status } });

export const deleteProduct = (productId) =>
  apiRequest(`${BASE}/delete-product`, { method: 'DELETE', body: { productId } });

export const cloneProduct = (productId) =>
  apiRequest(`${BASE}/clone-product`, { method: 'POST', body: { productId } });

// --- Bulk multi-select actions (checkbox selection in the admin table) ------
// All three return { results, successCount, failureCount } - see
// backend/utils/common.js's runBulkOperation.
export const bulkSetProductStatus = (productIds, status) =>
  apiRequest(`${BASE}/bulk-status`, { method: 'PATCH', body: { productIds, status } });

export const bulkDeleteProducts = (productIds) =>
  apiRequest(`${BASE}/bulk-delete`, { method: 'DELETE', body: { productIds } });

export const bulkCloneProducts = (productIds) =>
  apiRequest(`${BASE}/bulk-clone-products`, { method: 'POST', body: { productIds } });

// --- Bulk upload (excel) -----------------------------------------------------
/**
 * Adds products from an Excel workbook. Resolves to the per-row outcome
 * { totalRows, successCount, failedCount, failedRecords }.
 *
 * @param {File} excelFile - .xlsx with Products/Variants/Sizes/MeasurementValues/Descriptions/BulkPricing sheets
 * @param {File} [mainImagesZip] - zip of size main images referenced by MainImageFileName
 * @param {File} [additionalImagesZip] - zip of size additional images referenced by AdditionalImageFileNames
 */
export const bulkUploadProducts = (excelFile, mainImagesZip, additionalImagesZip) => {
  const formData = new FormData();
  formData.append('excelFile', excelFile);
  if (mainImagesZip) formData.append('mainImagesZip', mainImagesZip);
  if (additionalImagesZip) formData.append('additionalImagesZip', additionalImagesZip);

  return apiRequest(`${BASE}/bulk-upload-products`, { method: 'POST', body: formData });
};

/**
 * The sample .xlsx for a bulk upload: the six sheets with their headings plus an Instructions sheet.
 * @returns {Promise<{ blob: Blob, filename: string|null }>}
 */
export const downloadBulkUploadSampleFile = () => apiDownload(`${BASE}/bulk-upload-products/sample-file`);

/**
 * Products page > Download: a zip of products.xlsx (Bulk Update format) plus
 * main-images.zip / additional-images.zip. Takes the list's own params (q,
 * sort, categoryId, minPrice, maxPrice, stockStatus, minStock, maxStock) - or
 * `ids` (ticked products), which wins over them.
 * @returns {Promise<{ blob: Blob, filename: string|null, productCount: number, failedImageCount: number }>}
 */
export const exportProducts = async ({ ids, ...params } = {}) => {
  const { blob, filename, headers } = await apiDownload(
    `${BASE}/export-products${toQueryString(ids?.length ? { ids: ids.join(','), sort: params.sort } : params)}`
  );
  return {
    blob,
    filename,
    productCount: Number(headers?.get('X-Product-Count')) || 0,
    failedImageCount: Number(headers?.get('X-Failed-Image-Count')) || 0,
  };
};

export default {
  getProductsAdmin,
  getProductOptionsAdmin,
  getProductByIdAdmin,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
  cloneProduct,
  bulkSetProductStatus,
  bulkDeleteProducts,
  bulkCloneProducts,
  bulkUploadProducts,
  downloadBulkUploadSampleFile,
  exportProducts,
};

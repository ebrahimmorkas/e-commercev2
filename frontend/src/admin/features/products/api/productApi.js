import { apiRequest } from '../../../../utils/apiClient';

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

export const getProductsAdmin = () => apiRequest(`${BASE}/get-products-admin`);

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

export default {
  getProductsAdmin,
  getProductByIdAdmin,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
};

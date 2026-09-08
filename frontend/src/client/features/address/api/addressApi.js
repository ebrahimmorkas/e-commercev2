import { apiRequest } from '../../../../utils/apiClient';

/**
 * Storefront address book. All routes require a logged-in user (see
 * backend/routes/addressRoutes.js).
 *
 * KNOWN BACKEND BUGS (as of this writing - none of these can be fixed from
 * the frontend, backend is read-only here):
 *  1. addressRoutes.js imports `authenticate` but never adds it to any
 *     route, so req.user is undefined and every one of these calls will
 *     hang (no response ever sent) until that's fixed.
 *  2. createAddress's controller crashes (TypeError on `result.data._id`,
 *     since the service returns `{ meta }` not `{ data }`) after the
 *     address is already saved - so even once (1) is fixed, a create will
 *     save successfully in the DB but the HTTP request will still hang.
 *  3. updateAddress/deleteAddress: addressValidations' addressIdParamSchema
 *     is already wired to validate `params.id` on these routes, but the
 *     routes themselves have no `:id` segment (`/update-address`,
 *     `/delete-address`), and the controllers read an undefined `id`
 *     variable instead of `req.params.id`. The calls below assume the
 *     intended fix (matching the schema that's already there): add `:id` to
 *     both route paths and have the controllers read it from `req.params`.
 */

export const listAddresses = () => apiRequest('/address/get-address');

export const getAddressById = (id) => apiRequest(`/address/${id}`);

export const createAddress = (payload) => apiRequest('/address/add-address', { method: 'POST', body: payload });

// See bug (3) above - assumes the route becomes `/update-address/:id`.
export const updateAddress = (id, payload) =>
  apiRequest(`/address/update-address/${id}`, { method: 'PUT', body: payload });

// See bug (3) above - assumes the route becomes `/delete-address/:id`.
export const deleteAddress = (id) => apiRequest(`/address/delete-address/${id}`, { method: 'DELETE' });

export default { listAddresses, getAddressById, createAddress, updateAddress, deleteAddress };

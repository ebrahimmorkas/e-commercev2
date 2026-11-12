import { apiRequest } from '../../../../utils/apiClient';

const BASE = '/storefront';

/** { draft, published, hasUnpublishedChanges, publishedAt, options: { themes, fonts, sectionTypes } } */
export const getStorefrontSettings = () => apiRequest(`${BASE}/admin`);

/** Saves the vendor's draft (not visible to shoppers until published). */
export const saveStorefrontDraft = (config) => apiRequest(`${BASE}/draft`, { method: 'PUT', body: config });

export const publishStorefront = () => apiRequest(`${BASE}/publish`, { method: 'POST' });

/** Resets the draft back to what is currently published. */
export const discardStorefrontDraft = () => apiRequest(`${BASE}/discard`, { method: 'POST' });

import { CUSTOM_FIELD_PLACEMENTS } from '../constants';

const EMPTY_ENTITY = { hiddenFields: [], labelOverrides: {}, customFields: [], defaultLabels: {} };

/**
 * Helpers over ONE entity's field config, so a screen never reads the raw shape:
 *   isHidden(field)             - the vendor does not want to see this built-in field
 *   labelOf(field, fallback)    - the vendor's name for it, else the standard one
 *   customFieldsAt(mode, field) - custom fields drawn replacing / before / after a field
 *   endCustomFields             - custom fields drawn in the "Additional Details" block
 *   listCustomFields            - custom fields shown in admin lists / search results
 */
export const buildFieldConfigView = (entityConfig, isLoaded = true) => {
  const config = entityConfig || EMPTY_ENTITY;
  const hidden = new Set(config.hiddenFields || []);
  const customFields = config.customFields || [];
  return {
    isLoaded,
    customFields,
    isHidden: (field) => hidden.has(field),
    labelOf: (field, fallback) => config.labelOverrides?.[field] || fallback || config.defaultLabels?.[field] || field,
    customFieldsAt: (mode, field) => customFields.filter((cf) => cf.placement?.mode === mode && cf.placement?.field === field),
    endCustomFields: customFields.filter((cf) => !cf.placement || cf.placement.mode === CUSTOM_FIELD_PLACEMENTS.END),
    listCustomFields: customFields.filter((cf) => cf.showInAdminLists !== false),
  };
};

// [{ key, value }] (API) <-> { key: value } (form draft).
export const customFieldValuesToMap = (entries) => Object.fromEntries((entries || []).map((entry) => [entry.key, entry.value ?? '']));

export const customFieldMapToValues = (map) =>
  Object.entries(map || {}).map(([key, value]) => ({ key, value: value === '' || value === undefined ? null : value }));

const isEmptyValue = (value) => value === undefined || value === null || String(value).trim() === '';

// First required custom field left empty, or null.
export const findMissingRequiredCustomField = (view, map) =>
  view.customFields.find((cf) => cf.required && isEmptyValue(map?.[cf.key])) || null;

/**
 * What identifies a product in an admin list for this vendor: the product code
 * (unless hidden) and every list custom field that has a value, e.g.
 * [{ key: 'packetCode', label: 'Packet Code', value: 'PK-1' }, ...].
 */
export const describeProductIdentifiers = (product, view) => {
  if (!product) return [];
  const parts = [];
  if (!view.isHidden('productCode') && product.productCode) {
    parts.push({ key: 'productCode', label: view.labelOf('productCode', 'Product Code'), value: product.productCode });
  }
  const values = customFieldValuesToMap(product.customFieldValues);
  view.listCustomFields.forEach((cf) => {
    const value = values[cf.key];
    if (!isEmptyValue(value)) parts.push({ key: cf.key, label: cf.label, value: String(value) });
  });
  return parts;
};

// One line: just "PRD-000001" when the code is all there is, else "Packet Code: PK-1 · SAP Code: 77".
export const productIdentifierText = (product, view) => {
  const parts = describeProductIdentifiers(product, view);
  if (parts.length === 1 && parts[0].key === 'productCode') return parts[0].value;
  return parts.map((part) => `${part.label}: ${part.value}`).join(' · ');
};

// "Name (identifiers)" for pickers and dropdowns.
export const productOptionLabel = (product, view) => {
  const text = productIdentifierText(product, view);
  return text ? `${product.name} (${text})` : product.name;
};

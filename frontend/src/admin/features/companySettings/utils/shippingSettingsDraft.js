/**
 * Draft <-> API mapping and validation for the vendor's shipping price
 * settings (backend/models/ShippingPriceSettings.js).
 *
 * The vendor answers a chain of yes/no questions; the FIRST "yes" becomes the
 * single stored `method`. SHIPPING_STEPS is that chain, in order - a step is
 * only offered when the vendor is allowed that method
 * (CompanyMaster.allowedShippingPriceMethods; empty = all allowed).
 */
export const SHIPPING_STEPS = [
  { method: 'FREE', question: 'Is shipping price free?' },
  { method: 'FIXED', question: 'Is shipping price fixed?' },
  { method: 'CUSTOM', question: 'Do you want to enter the shipping price manually?' },
  { method: 'FREE_ABOVE', question: 'Is shipping free above a certain order amount?' },
  { method: 'WEIGHT', question: 'Is shipping price determined by weight?' },
  { method: 'CATEGORY', question: 'Is shipping price based on product category?' },
  { method: 'COUNTRY', question: 'Is shipping price based on country?' },
  { method: 'STATE', question: 'Is shipping price based on state?' },
  { method: 'CITY', question: 'Is shipping price based on city?' },
  { method: 'ZIP', question: 'Is shipping price based on zip code?' },
];

export const CATEGORY_CHARGE_MODE_OPTIONS = [
  { value: 'PER_ITEM', label: 'Per item (price x quantity)' },
  { value: 'ONE_TIME', label: 'One time per category' },
];

export const CATEGORY_AGGREGATION_OPTIONS = [
  { value: 'SUM', label: 'Add up all categories' },
  { value: 'HIGHEST', label: 'Highest category price' },
  { value: 'AVERAGE', label: 'Average of category prices' },
];

// Rule-list methods: which draft key holds the rows, which field is the picker, and its wording.
export const RULE_CONFIG = {
  CATEGORY: { rulesKey: 'categoryRules', idField: 'categoryId', restKey: 'categoryRestPrice', noun: 'category', restLabel: 'Price for all other categories' },
  COUNTRY: { rulesKey: 'countryRules', idField: 'countryId', restKey: 'countryRestPrice', noun: 'country', restLabel: 'Price for all other countries' },
  STATE: { rulesKey: 'stateRules', idField: 'stateId', restKey: 'stateRestPrice', noun: 'state', restLabel: 'Price for all other states' },
  CITY: { rulesKey: 'cityRules', idField: 'cityId', restKey: 'cityRestPrice', noun: 'city', restLabel: 'Price for all other cities' },
  ZIP: { rulesKey: 'zipRules', idField: 'zipCode', restKey: 'zipRestPrice', noun: 'zip code', restLabel: 'Price for all other zip codes' },
};

export const emptyShippingDraft = (method = 'FREE') => ({
  method,
  fixedPrice: '',
  freeAboveThreshold: '',
  freeAboveFallbackPrice: '',
  weightUnit: '',
  weightBrackets: [{ minWeight: '', maxWeight: '', price: '' }],
  weightRestPrice: '',
  categoryRules: [{ categoryId: '', price: '' }],
  categoryChargeMode: 'PER_ITEM',
  categoryAggregation: 'SUM',
  categoryRestPrice: '',
  countryRules: [{ countryId: '', price: '' }],
  countryRestPrice: '',
  stateRules: [{ stateId: '', price: '' }],
  stateRestPrice: '',
  cityRules: [{ cityId: '', price: '' }],
  cityRestPrice: '',
  zipRules: [{ zipCode: '', price: '' }],
  zipRestPrice: '',
});

const str = (value) => (value === null || value === undefined ? '' : String(value));

export const mapApiShippingToDraft = (settings) => {
  const base = emptyShippingDraft(settings?.method || 'FREE');
  if (!settings) return base;
  const rules = (list, idField, fallback) =>
    Array.isArray(list) && list.length > 0
      ? list.map((r) => ({ [idField]: str(r[idField]), price: str(r.price) }))
      : fallback;
  return {
    ...base,
    fixedPrice: str(settings.fixedPrice),
    freeAboveThreshold: str(settings.freeAboveThreshold),
    freeAboveFallbackPrice: str(settings.freeAboveFallbackPrice),
    weightUnit: str(settings.weightUnit),
    weightBrackets:
      Array.isArray(settings.weightBrackets) && settings.weightBrackets.length > 0
        ? settings.weightBrackets.map((b) => ({ minWeight: str(b.minWeight), maxWeight: str(b.maxWeight), price: str(b.price) }))
        : base.weightBrackets,
    weightRestPrice: str(settings.weightRestPrice),
    categoryRules: rules(settings.categoryRules, 'categoryId', base.categoryRules),
    categoryChargeMode: settings.categoryChargeMode || base.categoryChargeMode,
    categoryAggregation: settings.categoryAggregation || base.categoryAggregation,
    categoryRestPrice: str(settings.categoryRestPrice),
    countryRules: rules(settings.countryRules, 'countryId', base.countryRules),
    countryRestPrice: str(settings.countryRestPrice),
    stateRules: rules(settings.stateRules, 'stateId', base.stateRules),
    stateRestPrice: str(settings.stateRestPrice),
    cityRules: rules(settings.cityRules, 'cityId', base.cityRules),
    cityRestPrice: str(settings.cityRestPrice),
    zipRules: rules(settings.zipRules, 'zipCode', base.zipRules),
    zipRestPrice: str(settings.zipRestPrice),
  };
};

const isBlank = (value) => value === '' || value === null || value === undefined;
const isValidPrice = (value) => !isBlank(value) && Number.isFinite(Number(value)) && Number(value) >= 0;
// Blank rest price = "everywhere else ships free" (0), matching the backend default.
const restNumber = (value) => (isBlank(value) ? 0 : Number(value));

/** Builds the API body: only the active method's fields are sent (the backend forbids the rest). */
export const buildShippingPayload = (draft) => {
  const { method } = draft;
  const payload = { method };

  if (method === 'FIXED') payload.fixedPrice = Number(draft.fixedPrice);

  if (method === 'FREE_ABOVE') {
    payload.freeAboveThreshold = Number(draft.freeAboveThreshold);
    payload.freeAboveFallbackPrice = Number(draft.freeAboveFallbackPrice);
  }

  if (method === 'WEIGHT') {
    payload.weightUnit = draft.weightUnit;
    payload.weightBrackets = draft.weightBrackets.map((b) => ({
      minWeight: Number(b.minWeight),
      maxWeight: isBlank(b.maxWeight) ? null : Number(b.maxWeight),
      price: Number(b.price),
    }));
    payload.weightRestPrice = restNumber(draft.weightRestPrice);
  }

  if (RULE_CONFIG[method]) {
    const { rulesKey, idField, restKey } = RULE_CONFIG[method];
    payload[rulesKey] = draft[rulesKey].map((r) => ({
      [idField]: idField === 'zipCode' ? r[idField].trim() : r[idField],
      price: Number(r.price),
    }));
    payload[restKey] = restNumber(draft[restKey]);
    if (method === 'CATEGORY') {
      payload.categoryChargeMode = draft.categoryChargeMode;
      payload.categoryAggregation = draft.categoryAggregation;
    }
  }

  return payload;
};

/** Returns a list of human-readable problems ([] when the draft is valid). */
export const validateShippingDraft = (draft) => {
  const errors = [];
  const { method } = draft;

  if (method === 'FIXED' && !isValidPrice(draft.fixedPrice)) errors.push('Enter a fixed shipping price (0 or more).');

  if (method === 'FREE_ABOVE') {
    if (!isValidPrice(draft.freeAboveThreshold) || Number(draft.freeAboveThreshold) <= 0) {
      errors.push('Enter the order amount above which shipping is free (greater than 0).');
    }
    if (!isValidPrice(draft.freeAboveFallbackPrice)) errors.push('Enter the shipping price charged below that amount (0 or more).');
  }

  if (method === 'WEIGHT') {
    if (!draft.weightUnit) errors.push('Select a weight unit.');
    if (draft.weightBrackets.length === 0) errors.push('Add at least one weight range.');
    draft.weightBrackets.forEach((b, i) => {
      const label = `Weight range ${i + 1}`;
      if (!isValidPrice(b.minWeight)) errors.push(`${label}: enter a minimum weight (0 or more).`);
      if (!isBlank(b.maxWeight) && !isValidPrice(b.maxWeight)) errors.push(`${label}: maximum weight must be 0 or more.`);
      if (isValidPrice(b.minWeight) && !isBlank(b.maxWeight) && Number(b.maxWeight) < Number(b.minWeight)) {
        errors.push(`${label}: maximum cannot be less than minimum.`);
      }
      if (!isValidPrice(b.price)) errors.push(`${label}: enter a price (0 or more).`);
    });
    const sorted = draft.weightBrackets
      .filter((b) => isValidPrice(b.minWeight))
      .map((b) => ({ min: Number(b.minWeight), max: isBlank(b.maxWeight) ? null : Number(b.maxWeight) }))
      .sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      if (sorted[i].max === null || sorted[i].max > sorted[i + 1].min) {
        errors.push('Weight ranges must not overlap.');
        break;
      }
    }
    if (!isBlank(draft.weightRestPrice) && !isValidPrice(draft.weightRestPrice)) errors.push('Price for all other weights must be 0 or more.');
  }

  if (RULE_CONFIG[method]) {
    const { rulesKey, idField, restKey, noun, restLabel } = RULE_CONFIG[method];
    const rows = draft[rulesKey];
    if (rows.length === 0) errors.push(`Add at least one ${noun} price.`);
    const seen = new Set();
    rows.forEach((r, i) => {
      const key = String(r[idField] || '').trim().toLowerCase();
      if (!key) {
        errors.push(`Row ${i + 1}: ${method === 'ZIP' ? 'enter a zip code' : `select a ${noun}`}.`);
      } else if (seen.has(key)) {
        errors.push(`Row ${i + 1}: this ${noun} is already listed.`);
      } else {
        seen.add(key);
      }
      if (!isValidPrice(r.price)) errors.push(`Row ${i + 1}: enter a price (0 or more).`);
    });
    if (!isBlank(draft[restKey]) && !isValidPrice(draft[restKey])) errors.push(`${restLabel} must be 0 or more.`);
  }

  return errors;
};

import { useEffect, useMemo, useState } from 'react';
import Stepper from '../../../../components/common/Stepper';
import Button from '../../../../components/common/Buttons';
import Card from '../../../../components/common/Card';
import { useToast } from '../../../../components/common/Toast';
import ProductBasicsStep from './ProductBasicsStep';
import VariantsStep from './VariantsStep';
import ReviewStep from './ReviewStep';
import { emptyProduct, buildSubmitPayload } from '../utils/productDraft';
import theme from '../theme/theme';

const STEPS = [
  { key: 'basics', label: 'Basic Details' },
  { key: 'variants', label: 'Variants & Sizes' },
  { key: 'review', label: 'Review & Submit' },
];

// Every validator below returns either null (no problem) or a structured
// error - { field, message, variantIndex?, sizeIndex? } - instead of a bare
// string, so the caller can both toast the message AND drive the UI to the
// exact field (open its accordion, scroll to it, mark it red) rather than
// leaving the user to hunt for what's wrong.
const validateBasics = (draft) => {
  if (!draft.name.trim()) return { field: 'name', message: 'Product name is required.' };
  if (draft.colors.length === 0) return { field: 'colors', message: 'Add at least one color.' };
  return null;
};

const validateVariants = (draft) => {
  if (draft.variants.length === 0) return { field: 'variants', message: 'Add at least one variant.' };
  for (let variantIndex = 0; variantIndex < draft.variants.length; variantIndex++) {
    const variant = draft.variants[variantIndex];
    if (variant.sizes.length === 0) {
      return {
        field: 'variantSizes',
        variantIndex,
        message: `Variant "${variant.color || variant.displayName || ''}" needs at least one size.`,
      };
    }
    for (let sizeIndex = 0; sizeIndex < variant.sizes.length; sizeIndex++) {
      const size = variant.sizes[sizeIndex];
      const base = { variantIndex, sizeIndex };
      if (!size.sizeId) return { ...base, field: 'sizeId', message: 'Every size must reference a Size Master entry.' };
      if (!size.sizeName.trim()) return { ...base, field: 'sizeName', message: 'Every size needs a display name.' };
      if (size.sizeType === 'LABEL' && !size.labelValue) return { ...base, field: 'labelValue', message: `Size "${size.sizeName}" needs a label value.` };
      if (size.sizeType === 'MEASURABLE' && size.values.length === 0) return { ...base, field: 'values', message: `Size "${size.sizeName}" needs at least one measurement value.` };
      if (size.price === '' || Number(size.price) < 0) return { ...base, field: 'price', message: `Size "${size.sizeName}" needs a valid price.` };
      if (!size.sku.trim()) return { ...base, field: 'sku', message: `Size "${size.sizeName}" needs a SKU.` };
    }
  }
  return null;
};

/**
 * Multi-step product create/edit form. Holds the full draft tree in local
 * state and only calls onSubmit once the whole thing has passed the
 * client-side sanity checks above (final authority is still the backend's
 * Joi schema + business rules).
 */
const ProductForm = ({ mode = 'add', initialDraft, lookups, products = [], onSubmit, onCancel, submitting = false }) => {
  const [draft, setDraft] = useState(initialDraft || emptyProduct());
  const [step, setStep] = useState(0);
  // `id` is bumped on every failed validation (even a repeat of the same
  // field) so the scroll-to-field effect below re-fires even when the error
  // itself is unchanged - e.g. the user clicks Submit twice in a row without
  // fixing anything.
  const [fieldError, setFieldError] = useState(null);
  const toast = useToast();

  // Any edit clears the last error mark rather than leaving a red field
  // sitting there once the user has already fixed it - it's only ever
  // re-set by the next failed validation, on the next Next/Submit click.
  const handleDraftChange = (nextDraft) => {
    setDraft(nextDraft);
    if (fieldError) setFieldError(null);
  };

  // Drives the user to whatever field just failed validation instead of
  // leaving them to hunt for it after the toast: waits a tick for the step
  // switch / accordion auto-open (triggered by fieldError below in the child
  // steps) to render, then scrolls to and focuses the first marked field.
  useEffect(() => {
    if (!fieldError) return;
    const timer = setTimeout(() => {
      const el = document.querySelector('[aria-invalid="true"], [data-field-error="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus?.({ preventScroll: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [fieldError]);

  const { companySettings, companyMaster } = lookups;
  const isBulkPricingFeatureOn = companyMaster ? !!companyMaster.isBulkPricingFeatureOn : true;
  const isCategoryFeatureOn = companyMaster ? !!companyMaster.isCategoryFeatureOn : true;
  const isCategoryNestingAllowed = companyMaster ? !!companyMaster.isCategoryNestingAllowed : true;
  const isProductCodeAutoGenerated = companySettings ? !!companySettings.isProductCodeAutoGenerated : true;
  const isVariantCodeAutoGenerated = companySettings ? !!companySettings.isVariantCodeAutoGenerated : true;
  const isSizeCodeAutoGenerated = companySettings ? !!companySettings.isSizeCodeAutoGenerated : true;
  const maxVariants = companyMaster?.numberOfProductsVaiantsAllowed;

  const colorOptions = useMemo(() => draft.colors.map((c) => ({ value: c, label: c })), [draft.colors]);

  const recommendedProductOptions = useMemo(
    () =>
      products
        .filter((p) => p._id !== draft._id)
        .map((p) => ({ value: String(p._id), label: `${p.name}${p.productCode ? ` (${p.productCode})` : ''}` })),
    [products, draft._id]
  );

  const goNext = () => {
    const error = step === 0 ? validateBasics(draft) : step === 1 ? validateVariants(draft) : null;
    if (error) {
      toast.error(error.message);
      setFieldError({ ...error, id: Date.now() });
      return;
    }
    setFieldError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    const basicsError = validateBasics(draft);
    const variantsError = validateVariants(draft);
    const error = basicsError || variantsError;
    if (error) {
      toast.error(error.message);
      setFieldError({ ...error, id: Date.now() });
      setStep(basicsError ? 0 : 1);
      return;
    }
    setFieldError(null);
    const { payload, mainImages, additionalImageUploads } = buildSubmitPayload(draft, { isProductCodeAutoGenerated });
    await onSubmit(payload, mainImages, additionalImageUploads);
  };

  return (
    <div className="space-y-4 pb-4">
      <Card padding="none" className="overflow-visible">
        <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-gray-100">
          <Stepper steps={STEPS} currentStep={step} onStepClick={setStep} />
        </div>
        <div className="p-4 sm:p-6 space-y-4">
      {step === 0 && (
        <ProductBasicsStep
          draft={draft}
          onChange={handleDraftChange}
          fieldError={fieldError}
          categories={lookups.categories}
          taxOptions={lookups.taxOptions}
          recommendedProductOptions={recommendedProductOptions}
          isCategoryFeatureOn={isCategoryFeatureOn}
          isCategoryNestingAllowed={isCategoryNestingAllowed}
          isBulkPricingFeatureOn={isBulkPricingFeatureOn}
          isProductCodeAutoGenerated={isProductCodeAutoGenerated}
        />
      )}

      {step === 1 && (
        <VariantsStep
          draft={draft}
          onChange={handleDraftChange}
          fieldError={fieldError}
          colorOptions={colorOptions}
          sizeOptions={lookups.sizeOptions}
          getSizeMasterById={lookups.getSizeMasterById}
          unitOptions={lookups.unitOptions}
          weightOptions={lookups.weightOptions}
          brandOptions={lookups.brandOptions}
          countryOptions={lookups.countryOptions}
          stateOptions={lookups.stateOptions}
          cityOptions={lookups.cityOptions}
          isBulkPricingFeatureOn={isBulkPricingFeatureOn}
          isSizeCodeAutoGenerated={isSizeCodeAutoGenerated}
          isVariantCodeAutoGenerated={isVariantCodeAutoGenerated}
          maxVariants={maxVariants}
        />
      )}

      {step === 2 && <ReviewStep draft={draft} />}
        </div>
      </Card>

      <div className="sticky bottom-3 sm:bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3 shadow-lg">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          {step > 0 && (
            <Button type="button" variant={theme.button.secondary} onClick={goBack} disabled={submitting}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" variant={theme.button.primary} onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button type="button" variant={theme.button.primary} onClick={handleSubmit} loading={submitting}>
              {mode === 'edit' ? 'Save Changes' : 'Create Product'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductForm;

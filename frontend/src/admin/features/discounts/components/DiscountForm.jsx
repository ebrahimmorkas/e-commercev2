import { useState } from 'react';
import Stepper from '../../../../components/common/Stepper';
import Button from '../../../../components/common/Buttons';
import Card from '../../../../components/common/Card';
import { useToast } from '../../../../components/common/Toast';
import BasicDetailsStep from './BasicDetailsStep';
import TargetingStep from './TargetingStep';
import TimingStep from './TimingStep';
import RulesStep from './RulesStep';
import ReviewStep from './ReviewStep';
import { emptyDraft, buildSubmitFields, needsExcelFor } from '../utils/discountDraft';
import { GIVE_DISCOUNT_TO_CONFIG } from '../constants';
import theme from '../theme/theme';

const STEPS = [
  { key: 'basics', label: 'Basic Details' },
  { key: 'targeting', label: 'Who Gets It' },
  { key: 'timing', label: 'Timing' },
  { key: 'rules', label: 'Rules' },
  { key: 'review', label: 'Review & Submit' },
];

const validateBasics = (draft) => {
  if (!draft.name.trim()) return 'Discount name is required.';
  if (draft.discountValue === '' || Number(draft.discountValue) < 0) return 'A valid discount value is required.';
  if (draft.discountType === 'PERCENTAGE' && Number(draft.discountValue) > 100) return 'Percentage discount value cannot exceed 100.';
  return null;
};

const validateTargeting = (draft) => {
  const config = GIVE_DISCOUNT_TO_CONFIG[draft.giveDiscountTo];
  if (!config) return 'Choose who this discount applies to.';
  if (config.notSupported) return 'This targeting option is not supported yet - choose a different one.';
  if (needsExcelFor(draft.giveDiscountTo) && !draft.excelFile) return 'An excel file is required for this targeting option.';
  if (config.needsProductGroupIds && draft.productGroupIds.length === 0) return 'Select at least one product group.';
  if (config.needsCategoryGroupIds && draft.categoryGroupIds.length === 0) return 'Select at least one category group.';
  if (config.needsUserGroupIds && draft.userGroupIds.length === 0) return 'Select at least one user group.';
  return null;
};

const validateTiming = (draft) => {
  if (draft.discountFlow === 'MIN_QTY' && (!draft.minimumQuantity || Number(draft.minimumQuantity) < 1)) {
    return 'A valid minimum quantity is required.';
  }
  if (draft.discountFlow === 'COUPON' && !draft.couponCode.trim()) {
    return 'A coupon code is required.';
  }
  if (draft.discountFlow !== 'ONGOING') {
    if (!draft.startDate || !draft.endDate) return 'Start date and end date are required.';
    if (draft.endDate < draft.startDate) return 'End date cannot be before start date.';
  }
  return null;
};

const validateRules = (draft) => {
  if (draft.isDiscountOpenForSpecificDays) {
    if (draft.specificDays.length === 0) return 'Select at least one active day.';
    if (draft.isDiscountOpenForSpecificHours && (!draft.specificHoursStartTime || !draft.specificHoursEndTime)) {
      return 'Start and end time are required when restricting to specific hours.';
    }
  }
  if (draft.isDiscountBasedOnPaymentMethods && draft.discountOnPaymentMethods.length === 0) {
    return 'Select at least one eligible payment method.';
  }
  if (draft.isDiscountReusable && (!draft.discountReusableNumber || Number(draft.discountReusableNumber) < 1)) {
    return 'A valid reuse count is required.';
  }
  return null;
};

const VALIDATORS = [validateBasics, validateTargeting, validateTiming, validateRules, null];

/**
 * Multi-step discount create/edit form, mirroring
 * admin/features/products/components/ProductForm.jsx's pattern: local draft
 * state, per-step validation gating "Next", final authority still the
 * backend (discountService.js's Joi-less hand-rolled validators).
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} [props.initialDraft]
 * @param {Object} props.lookups - { companyMaster, productGroupOptions, categoryGroupOptions, userGroupOptions }
 * @param {(fields: Object, excelFile: File|null) => Promise<void>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const DiscountForm = ({ mode = 'add', initialDraft, lookups, onSubmit, onCancel, submitting = false }) => {
  const [draft, setDraft] = useState(initialDraft || emptyDraft());
  const [step, setStep] = useState(0);
  const toast = useToast();

  const { companyMaster } = lookups;
  const allowedGiveDiscountTo = companyMaster?.allowedConstantsOfGiveDiscountTo || [];
  const allowedDiscountTypes = companyMaster?.allowedDiscountTypes || [];
  const allowedFeatureTypes = companyMaster?.allowedDiscountFeatureTypes || [];

  const goNext = () => {
    const validator = VALIDATORS[step];
    const error = validator ? validator(draft) : null;
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    for (let i = 0; i < VALIDATORS.length; i += 1) {
      const validator = VALIDATORS[i];
      const error = validator ? validator(draft) : null;
      if (error) {
        toast.error(error);
        setStep(i);
        return;
      }
    }
    const fields = buildSubmitFields(draft, { includeStatus: mode === 'edit' });
    const excelFile = needsExcelFor(draft.giveDiscountTo) ? draft.excelFile : null;
    await onSubmit(fields, excelFile);
  };

  return (
    <div className="space-y-4 pb-4">
      <Card padding="none" className="overflow-visible">
        <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-gray-100">
          <Stepper steps={STEPS} currentStep={step} onStepClick={setStep} />
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          {step === 0 && (
            <BasicDetailsStep draft={draft} onChange={setDraft} allowedDiscountTypes={allowedDiscountTypes} />
          )}
          {step === 1 && (
            <TargetingStep
              draft={draft}
              onChange={setDraft}
              allowedGiveDiscountTo={allowedGiveDiscountTo}
              productGroupOptions={lookups.productGroupOptions}
              categoryGroupOptions={lookups.categoryGroupOptions}
              userGroupOptions={lookups.userGroupOptions}
              isEdit={mode === 'edit'}
            />
          )}
          {step === 2 && <TimingStep draft={draft} onChange={setDraft} allowedFeatureTypes={allowedFeatureTypes} />}
          {step === 3 && <RulesStep draft={draft} onChange={setDraft} />}
          {step === 4 && <ReviewStep draft={draft} onChange={setDraft} isEdit={mode === 'edit'} />}
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
              {mode === 'edit' ? 'Save Changes' : 'Create Discount'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscountForm;

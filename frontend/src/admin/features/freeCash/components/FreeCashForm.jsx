import { useState } from 'react';
import Stepper from '../../../../components/common/Stepper';
import Button from '../../../../components/common/Buttons';
import Card from '../../../../components/common/Card';
import { useToast } from '../../../../components/common/Toast';
import BasicDetailsStep from './BasicDetailsStep';
import TargetingStep from './TargetingStep';
import TimingStep from './TimingStep';
import ReviewStep from './ReviewStep';
import { emptyDraft, buildSubmitFields, needsExcelFor } from '../utils/freeCashDraft';
import { GIVE_FREE_CASH_TO_CONFIG } from '../constants';
import theme from '../theme/theme';

const STEPS = [
  { key: 'basics', label: 'Basic Details' },
  { key: 'targeting', label: 'Who Gets It' },
  { key: 'timing', label: 'Timing' },
  { key: 'review', label: 'Review & Submit' },
];

const validateBasics = (draft) => {
  if (!draft.freeCashName.trim()) return 'Free Cash name is required.';
  if (draft.freeCashAmount === '' || Number(draft.freeCashAmount) < 0) return 'A valid Free Cash amount is required.';
  if (draft.maxCashUsagePerOrder !== '' && Number(draft.maxCashUsagePerOrder) > Number(draft.freeCashAmount)) {
    return 'Max usage per order cannot exceed the Free Cash amount.';
  }
  return null;
};

const validateTargeting = (draft) => {
  const config = GIVE_FREE_CASH_TO_CONFIG[draft.giveFreeCashTo];
  if (!config) return 'Choose who this Free Cash applies to.';
  if (needsExcelFor(draft.giveFreeCashTo) && !draft.excelFile) return 'An excel file is required for this targeting option.';
  if (config.needsUserGroupIds && draft.userGroupIds.length === 0) return 'Select at least one user group.';
  if (config.needsMainCategoryIds && draft.mainCategoryIds.length === 0) return 'Select at least one main category.';
  return null;
};

const validateTiming = (draft) => {
  if (!draft.startDate || !draft.endDate) return 'Start date and end date are required.';
  if (draft.endDate < draft.startDate) return 'End date cannot be before start date.';
  return null;
};

const VALIDATORS = [validateBasics, validateTargeting, validateTiming, null];

/**
 * Multi-step Free Cash create/edit form, mirroring
 * admin/features/discounts/components/DiscountForm.jsx's pattern: local
 * draft state, per-step validation gating "Next", final authority still the
 * backend (freeCashService.js's hand-rolled validators).
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} [props.initialDraft]
 * @param {Object} props.lookups - { companyMaster, mainCategoryOptions, getSubCategoryOptions, userGroupOptions }
 * @param {(fields: Object, excelFile: File|null) => Promise<void>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const FreeCashForm = ({ mode = 'add', initialDraft, lookups, onSubmit, onCancel, submitting = false }) => {
  const [draft, setDraft] = useState(initialDraft || emptyDraft());
  const [step, setStep] = useState(0);
  const toast = useToast();

  const { companyMaster } = lookups;
  const allowedGiveFreeCashTo = companyMaster?.freeCashOptions || [];

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
    const excelFile = needsExcelFor(draft.giveFreeCashTo) ? draft.excelFile : null;
    await onSubmit(fields, excelFile);
  };

  return (
    <div className="space-y-4 pb-4">
      <Card padding="none" className="overflow-visible">
        <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-gray-100">
          <Stepper steps={STEPS} currentStep={step} onStepClick={setStep} />
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          {step === 0 && <BasicDetailsStep draft={draft} onChange={setDraft} />}
          {step === 1 && (
            <TargetingStep
              draft={draft}
              onChange={setDraft}
              allowedGiveFreeCashTo={allowedGiveFreeCashTo}
              userGroupOptions={lookups.userGroupOptions}
              mainCategoryOptions={lookups.mainCategoryOptions}
              getSubCategoryOptions={lookups.getSubCategoryOptions}
              isEdit={mode === 'edit'}
            />
          )}
          {step === 2 && <TimingStep draft={draft} onChange={setDraft} />}
          {step === 3 && <ReviewStep draft={draft} onChange={setDraft} isEdit={mode === 'edit'} />}
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
              {mode === 'edit' ? 'Save Changes' : 'Create Free Cash'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreeCashForm;

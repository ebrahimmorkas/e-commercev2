import Switch from '../../../../components/common/Switch';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import Avatar from '../../../../components/common/Avatar';
import TextArea from '../../../../components/common/TextArea';
import RadioGroup from '../../../../components/common/Radio';
import Checkbox from '../../../../components/common/Checkbox';
import Spinner from '../../../../components/common/Spinner';
import { BANK_FIELD_TYPES, bankValuesFor } from '../utils/bankDetails';
import theme from '../theme/theme';

const FieldError = ({ message }) => (message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null);

/**
 * One bank field, drawn by its type (text, textarea, number, radio, dropdown, checkbox).
 */
const BankFieldInput = ({ field, value, error, onChange }) => {
  const options = (field.options || []).map((option) => ({ value: option.value, label: option.label }));
  const label = field.isRequired ? `${field.label} *` : field.label;

  switch (field.type) {
    case BANK_FIELD_TYPES.TEXTAREA:
      return (
        <div className="sm:col-span-2">
          <TextArea
            label={label}
            placeholder={field.placeholder || ''}
            maxLength={field.maxLength || null}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            showError={false}
          />
          <FieldError message={error} />
        </div>
      );
    case BANK_FIELD_TYPES.NUMBER:
      return (
        <InputField
          type="number"
          label={label}
          placeholder={field.placeholder || ''}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      );
    case BANK_FIELD_TYPES.RADIO:
      return (
        <RadioGroup
          name={`bank-${field.key}`}
          label={label}
          options={options}
          value={value ?? ''}
          onChange={(val) => onChange(val)}
          direction="horizontal"
          error={error}
        />
      );
    case BANK_FIELD_TYPES.DROPDOWN:
      return (
        <Dropdown
          label={label}
          options={options}
          value={value ?? ''}
          onChange={(val) => onChange(val || null)}
          clearable={!field.isRequired}
          error={error}
        />
      );
    case BANK_FIELD_TYPES.CHECKBOX: {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (optionValue, checked) =>
        onChange(checked ? [...selected, optionValue] : selected.filter((item) => item !== optionValue));
      return (
        <fieldset>
          <legend className={`block text-sm font-medium ${theme.text.heading} mb-1`}>{label}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={selected.includes(option.value)}
                onChange={(e) => toggle(option.value, e.target.checked)}
              />
            ))}
          </div>
          <FieldError message={error} />
        </fieldset>
      );
    }
    default:
      return (
        <InputField
          label={label}
          placeholder={field.placeholder || ''}
          maxLength={field.maxLength || null}
          value={value ?? ''}
          onChange={(e) => onChange(field.isUppercase ? e.target.value.toUpperCase() : e.target.value)}
          error={error}
        />
      );
  }
};

/**
 * Online payment toggle, plus the Bank Transfer QR/details group and GPay number -
 * entitlement-gated features (CompanyMaster.showPaymentQRCodeAndBankDetails /
 * showGpayNumber), so their sections are hidden entirely when the vendor isn't
 * entitled, matching the server-side gate in companySettingsService. (The
 * partner certificate lives on the Storefront tab.)
 *
 * The bank details form is drawn from the store country's bank fields (set
 * up per country by the platform, e.g. IFSC Code for India, IBAN for the UAE).
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {Object|null} props.companyMaster
 * @param {{ country: Object|null, fields: Array<Object>, loading: boolean, error: string }} props.bankFields - useBankFields
 * @param {Object} [props.bankErrors] - { [fieldKey]: message }
 */
const PaymentBankSection = ({ draft, onChange, companyMaster, bankFields, bankErrors = {} }) => {
  const set = (patch) => onChange(patch);

  const bankTransferEnabled = !!companyMaster?.showPaymentQRCodeAndBankDetails;
  const gpayEnabled = !!companyMaster?.showGpayNumber;

  const countryId = draft.storeCountryId;
  const bankValues = bankValuesFor(draft, countryId);
  const setBankValue = (key, value) =>
    set({
      bankDetailsByCountry: {
        ...draft.bankDetailsByCountry,
        [countryId]: { ...bankValues, [key]: value },
      },
    });

  const renderBankFields = () => {
    if (!countryId) {
      return (
        <p className={`text-sm ${theme.text.muted}`}>
          Select your store country on the General tab first - the bank details asked for depend on it.
        </p>
      );
    }
    if (bankFields?.loading) {
      return (
        <div className="py-4 flex justify-center">
          <Spinner size="md" />
        </div>
      );
    }
    if (bankFields?.error) {
      return <p className="text-sm text-red-600">{bankFields.error}</p>;
    }
    if (!bankFields?.fields?.length) {
      return (
        <p className={`text-sm ${theme.text.muted}`}>
          No bank fields are set up for {bankFields?.country?.name || 'your store country'} yet, so bank details can't be added. Please contact support.
        </p>
      );
    }
    return (
      <>
        <p className={`text-xs ${theme.text.muted} mb-3`}>
          Bank details for {bankFields.country?.name || 'your store country'}. Fields marked * are required once you fill in any of them.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bankFields.fields.map((field) => (
            <BankFieldInput
              key={field.key}
              field={field}
              value={bankValues[field.key]}
              error={bankErrors[field.key]}
              onChange={(value) => setBankValue(field.key, value)}
            />
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Switch
          label="Online Payment at Checkout"
          description="Turn off to fall back to COD without waiting on the platform admin (e.g. if your gateway subscription lapses)."
          checked={draft.isPaymentGatewayFeatureOn}
          onChange={(e) => set({ isPaymentGatewayFeatureOn: e.target.checked })}
          color={theme.switch.color}
        />
      </div>

      <div>
        <Switch
          label="Cash on Delivery"
          description="Offer Cash on Delivery at checkout. It only appears when the platform has also enabled it for your store."
          checked={draft.isCODFeatureOn}
          onChange={(e) => set({ isCODFeatureOn: e.target.checked })}
          color={theme.switch.color}
        />
      </div>

      {bankTransferEnabled && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Bank Transfer</h3>
          <p className={`text-xs ${theme.text.muted} mt-0.5 mb-3`}>
            Shown to customers as a payment option alongside a scannable QR code.
          </p>

          <div className="flex items-start gap-4 mb-4">
            {draft.paymentScanner?.url && !(draft.paymentScanner instanceof File) && (
              <Avatar src={draft.paymentScanner.url} name="Payment QR" shape="square" size="xl" />
            )}
            <div className="flex-1">
              <FileUpload
                label={draft.paymentScanner?.url ? 'Replace Payment QR Code' : 'Payment QR Code'}
                accept="image/*"
                maxSize={5 * 1024 * 1024}
                onFilesSelected={(files) => set({ paymentScanner: files[0] || (draft.paymentScanner?.url ? draft.paymentScanner : null) })}
                helperText="JPG, JPEG or PNG. Up to 5MB."
              />
            </div>
          </div>

          {renderBankFields()}
        </div>
      )}

      {gpayEnabled && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className={`text-sm font-semibold ${theme.text.heading}`}>GPay</h3>
          <p className={`text-xs ${theme.text.muted} mt-0.5 mb-3`}>
            Shown to customers as a number they can pay to.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="GPay Number"
              placeholder="e.g. +971 50 123 4567"
              value={draft.gpayNumber}
              onChange={(e) => set({ gpayNumber: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentBankSection;

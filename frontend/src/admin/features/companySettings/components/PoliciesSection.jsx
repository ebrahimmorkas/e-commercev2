import HtmlEditor from '../../../../components/common/HtmlEditor';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import theme from '../theme/theme';

const POLICY_DISPLAY_MODE_OPTIONS = [
  { value: 'PAGE', label: 'Dedicated page (e.g. /privacy-policy)' },
  { value: 'MODAL', label: 'Modal popup on the current page' },
];

/**
 * Storefront policy text (stored as HTML on the backend), edited with the
 * same rich HTML editor used by Email Templates (formatting toolbar +
 * HTML/Preview tabs).
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const PoliciesSection = ({ draft, onChange }) => {
  const set = (patch) => onChange(patch);

  return (
    <div className="space-y-6">
      <p className={`text-xs ${theme.text.muted}`}>
        These are shown to customers on the storefront.
      </p>

      <Dropdown
        label="How should these open for customers?"
        options={POLICY_DISPLAY_MODE_OPTIONS}
        value={draft.policyDisplayMode}
        onChange={(val) => set({ policyDisplayMode: val || 'PAGE' })}
        helperText="Applies to every policy link and About Us in the storefront footer."
      />

      <HtmlEditor
        label="Privacy Policy"
        name="privacyPolicy"
        rows={6}
        value={draft.privacyPolicy}
        onChange={(html) => set({ privacyPolicy: html })}
      />
      <HtmlEditor
        label="Cancellation Policy"
        name="cancelPolicy"
        rows={6}
        value={draft.cancelPolicy}
        onChange={(html) => set({ cancelPolicy: html })}
      />
      <HtmlEditor
        label="Return and Refund Policy"
        name="returnRefundPolicy"
        rows={6}
        value={draft.returnRefundPolicy}
        onChange={(html) => set({ returnRefundPolicy: html })}
        helperText="Shown to customers alongside your other storefront policies."
      />
      <HtmlEditor
        label="Shipping Policy"
        name="shippingPolicy"
        rows={6}
        value={draft.shippingPolicy}
        onChange={(html) => set({ shippingPolicy: html })}
      />
      <HtmlEditor
        label="Terms and Conditions"
        name="termsAndConditions"
        rows={6}
        value={draft.termsAndConditions}
        onChange={(html) => set({ termsAndConditions: html })}
      />
      <HtmlEditor
        label="About Us"
        name="aboutUs"
        rows={6}
        value={draft.aboutUs}
        onChange={(html) => set({ aboutUs: html })}
      />

      <div className="pt-4 border-t border-gray-100">
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Contact Us</h3>
        <p className={`text-xs ${theme.text.muted} mt-0.5 mb-3`}>
          Shown in the storefront footer. Separate from your Admin Contact details on the General tab, which are
          internal only.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Phone Number"
            name="contactPhoneNumber"
            placeholder="e.g. +91 98765 43210"
            value={draft.contactPhoneNumber}
            onChange={(e) => set({ contactPhoneNumber: e.target.value })}
          />
          <InputField
            type="email"
            label="Email"
            name="contactEmail"
            placeholder="contact@example.com"
            value={draft.contactEmail}
            onChange={(e) => set({ contactEmail: e.target.value })}
          />
        </div>
        <div className="mt-4">
          <InputField
            label="Address"
            name="contactAddress"
            placeholder="Shop address shown to customers"
            value={draft.contactAddress}
            onChange={(e) => set({ contactAddress: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
};

export default PoliciesSection;

import TextArea from '../../../../components/common/TextArea';
import theme from '../theme/theme';

/**
 * Storefront policy text (stored as HTML on the backend - this form edits it
 * as plain text/HTML source since there's no rich-text editor in this
 * codebase yet).
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const PoliciesSection = ({ draft, onChange }) => {
  const set = (patch) => onChange(patch);

  return (
    <div className="space-y-5">
      <p className={`text-xs ${theme.text.muted}`}>
        These are shown to customers on the storefront. Basic HTML (e.g. &lt;p&gt;, &lt;b&gt;, &lt;ul&gt;) is supported.
      </p>
      <TextArea
        label="Privacy Policy"
        name="privacyPolicy"
        rows={6}
        value={draft.privacyPolicy}
        onChange={(e) => set({ privacyPolicy: e.target.value })}
      />
      <TextArea
        label="Cancellation Policy"
        name="cancelPolicy"
        rows={6}
        value={draft.cancelPolicy}
        onChange={(e) => set({ cancelPolicy: e.target.value })}
      />
      <TextArea
        label="Terms and Conditions"
        name="termsAndConditions"
        rows={6}
        value={draft.termsAndConditions}
        onChange={(e) => set({ termsAndConditions: e.target.value })}
      />
      <TextArea
        label="About Us"
        name="aboutUs"
        rows={6}
        value={draft.aboutUs}
        onChange={(e) => set({ aboutUs: e.target.value })}
      />
    </div>
  );
};

export default PoliciesSection;

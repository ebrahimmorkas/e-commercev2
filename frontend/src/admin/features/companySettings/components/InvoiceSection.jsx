import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import Switch from '../../../../components/common/Switch';
import theme from '../theme/theme';

const DEFAULT_PREFIX = 'SI';

/**
 * Seller-side details for the PDF invoice generated when an order is placed. The rest of
 * what the invoice prints (company name, address, phone, email, logo, bank details) comes
 * from the other tabs of this page.
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {Object} [props.errors] - field errors keyed by draft field
 */
const InvoiceSection = ({ draft, onChange, errors = {} }) => {
  const set = (patch) => onChange(patch);
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const previewPrefix = (draft.invoicePrefix || DEFAULT_PREFIX).toUpperCase();

  return (
    <div className="space-y-5">
      <p className={`text-xs ${theme.text.muted}`}>
        A PDF invoice is generated for every order when it is placed. It prints the details below together with your company
        name, address, phone, email, logo and bank details from the other tabs - fill those in too so the invoice is complete.
      </p>

      <div>
        <InputField
          label="Tax Registration Number (TRN)"
          name="taxRegistrationNumber"
          placeholder="15 digits"
          inputMode="numeric"
          maxLength={15}
          value={draft.taxRegistrationNumber}
          onChange={(e) => set({ taxRegistrationNumber: e.target.value.replace(/\D/g, '') })}
          error={errors.taxRegistrationNumber}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          Printed in the invoice header. Leave it blank if your business is not tax registered - the document is then titled
          &ldquo;Invoice&rdquo; instead of &ldquo;Tax Invoice&rdquo;.
        </p>
      </div>

      <div>
        <InputField
          label="Invoice number prefix"
          name="invoicePrefix"
          placeholder={DEFAULT_PREFIX}
          maxLength={10}
          value={draft.invoicePrefix}
          onChange={(e) => set({ invoicePrefix: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase() })}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          Invoice numbers are the prefix, the two-digit year and a running number that restarts every year - for example{' '}
          <span className="font-medium">
            {previewPrefix}
            {yearSuffix}/1
          </span>
          . Changing the prefix only affects invoices issued from then on.
        </p>
      </div>

      <div>
        <TextArea
          label="Declaration"
          name="invoiceDeclaration"
          rows={3}
          maxLength={500}
          placeholder="We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
          value={draft.invoiceDeclaration}
          onChange={(e) => set({ invoiceDeclaration: e.target.value })}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>Printed above the signature boxes. Leave blank to use the standard wording shown above.</p>
      </div>

      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <Switch
          label="Print Original and Duplicate copies"
          description="Put two labelled copies, Original and Duplicate, in the same PDF."
          checked={draft.invoicePrintDuplicateCopy}
          onChange={(e) => set({ invoicePrintDuplicateCopy: e.target.checked })}
          color={theme.switch.color}
        />
        <Switch
          label="Round the invoice total to a whole amount"
          description="Adds a 'Round off' row so the total is a whole number. Online card payments still charge the exact order amount, so turn this on only if you collect payment against the invoice total (cash or bank transfer)."
          checked={draft.invoiceRoundOffToWhole}
          onChange={(e) => set({ invoiceRoundOffToWhole: e.target.checked })}
          color={theme.switch.color}
        />
        <Switch
          label="Email the invoice when an order is placed"
          description="Sends the customer their invoice PDF by email right after they order. Needs email sending and attachments to be allowed for your account, with PDF among the allowed attachment types. Customers without an email address are skipped."
          checked={draft.emailInvoiceOnOrderPlaced}
          onChange={(e) => set({ emailInvoiceOnOrderPlaced: e.target.checked })}
          color={theme.switch.color}
        />
      </div>
    </div>
  );
};

export default InvoiceSection;

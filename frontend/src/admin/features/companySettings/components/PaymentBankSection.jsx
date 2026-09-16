import Switch from '../../../../components/common/Switch';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import Avatar from '../../../../components/common/Avatar';
import theme from '../theme/theme';

const BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CURRENT', label: 'Current' },
];

/**
 * Online payment toggle, plus the Bank Transfer QR/details group and Partner
 * Certificate upload - both of the latter are entitlement-gated features
 * (CompanyMaster.showPaymentQRCodeAndBankDetails /
 * isShowingPartnerCertificateFeatureOn), so their sections are hidden
 * entirely when the vendor isn't entitled, matching the server-side gate in
 * companySettingsService.checkPaymentDetailsEntitlements.
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {Object|null} props.companyMaster
 */
const PaymentBankSection = ({ draft, onChange, companyMaster }) => {
  const set = (patch) => onChange(patch);

  const bankTransferEnabled = !!companyMaster?.showPaymentQRCodeAndBankDetails;
  const partnerCertificateEnabled = !!companyMaster?.isShowingPartnerCertificateFeatureOn;

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Account Holder Name"
              value={draft.bankAccountHolderName}
              onChange={(e) => set({ bankAccountHolderName: e.target.value })}
            />
            <InputField
              label="Bank Name"
              value={draft.bankName}
              onChange={(e) => set({ bankName: e.target.value })}
            />
            <InputField
              label="Account Number"
              value={draft.bankAccountNumber}
              onChange={(e) => set({ bankAccountNumber: e.target.value })}
            />
            <InputField
              label="IFSC Code"
              placeholder="e.g. ABCD0123456"
              value={draft.ifscCode}
              onChange={(e) => set({ ifscCode: e.target.value.toUpperCase() })}
            />
            <InputField
              label="Branch Name"
              value={draft.branchName}
              onChange={(e) => set({ branchName: e.target.value })}
            />
            <InputField
              label="SWIFT / BIC Code"
              placeholder="e.g. ABCDUS33XXX"
              value={draft.swiftCode}
              onChange={(e) => set({ swiftCode: e.target.value.toUpperCase() })}
            />
            <Dropdown
              label="Account Type"
              options={BANK_ACCOUNT_TYPE_OPTIONS}
              value={draft.bankAccountType}
              onChange={(val) => set({ bankAccountType: val })}
              clearable
            />
          </div>
        </div>
      )}

      {partnerCertificateEnabled && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className={`text-sm font-semibold ${theme.text.heading} mb-3`}>Partner Certificate</h3>
          <div className="flex items-start gap-4">
            {draft.partnerCertificate?.url && !(draft.partnerCertificate instanceof File) && (
              <Avatar src={draft.partnerCertificate.url} name="Partner Certificate" shape="square" size="xl" />
            )}
            <div className="flex-1">
              <FileUpload
                label={draft.partnerCertificate?.url ? 'Replace Certificate' : 'Certificate Image'}
                accept="image/*"
                maxSize={5 * 1024 * 1024}
                onFilesSelected={(files) => set({ partnerCertificate: files[0] || (draft.partnerCertificate?.url ? draft.partnerCertificate : null) })}
                helperText="JPG, JPEG or PNG. Up to 5MB."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentBankSection;

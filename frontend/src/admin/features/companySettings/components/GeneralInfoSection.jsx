import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import Avatar from '../../../../components/common/Avatar';
import theme from '../theme/theme';
import { useStoreLocationOptions } from '../hooks/useStoreLocationOptions';

/**
 * Admin contact details, company identity (name + logo) and social links.
 *
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {Object} [props.errors]
 */
const GeneralInfoSection = ({ draft, onChange, errors = {} }) => {
  const set = (patch) => onChange(patch);
  const { countryOptions, stateOptions, cityOptions, currencyOptions } = useStoreLocationOptions(draft.storeCountryId, draft.storeStateId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Store Currency</h3>
        <p className={`text-xs ${theme.text.muted} mt-0.5`}>
          Every price, shipping charge, discount and free cash amount is entered in this currency. Customers from another country you serve see prices converted to their own currency.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <Dropdown
            label="Store Currency"
            name="currencyId"
            placeholder={currencyOptions.length ? 'Select a currency' : 'No currencies available'}
            options={currencyOptions}
            value={draft.currencyId}
            onChange={(value) => set({ currencyId: value || draft.currencyId })}
            searchable
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Store Location</h3>
        <p className={`text-xs ${theme.text.muted} mt-0.5`}>
          Used to work out tax whenever the customer&apos;s location is unknown - walk-in sales, admin orders with a typed-in address, and cart estimates for visitors with no location. Leave the country empty to charge no tax in those cases.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <Dropdown
            label="Store Country"
            name="storeCountryId"
            placeholder={countryOptions.length ? 'Select a country' : 'No countries available'}
            options={countryOptions}
            value={draft.storeCountryId}
            // A new country invalidates the state and city picked under the old one.
            onChange={(value) => set({ storeCountryId: value || '', storeStateId: '', storeCityId: '' })}
            clearable
            searchable
          />
          <Dropdown
            label="Store State"
            name="storeStateId"
            placeholder={draft.storeCountryId ? 'Select a state' : 'Select a country first'}
            options={stateOptions}
            value={draft.storeStateId}
            onChange={(value) => set({ storeStateId: value || '', storeCityId: '' })}
            disabled={!draft.storeCountryId}
            clearable
            searchable
          />
          <Dropdown
            label="Store City"
            name="storeCityId"
            placeholder={draft.storeStateId ? 'Select a city' : 'Select a state first'}
            options={cityOptions}
            value={draft.storeCityId}
            onChange={(value) => set({ storeCityId: value || '' })}
            disabled={!draft.storeStateId}
            clearable
            searchable
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Admin Contact</h3>
        <p className={`text-xs ${theme.text.muted} mt-0.5`}>Shown internally and used for order/system notifications.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <InputField
              label="Admin Name"
              name="adminName"
              placeholder="e.g. Jane Doe"
              value={draft.adminName}
              onChange={(e) => set({ adminName: e.target.value })}
              required
              showError={false}
            />
            {errors.adminName && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.adminName}</p>}
          </div>
          <div>
            <InputField
              type="email"
              label="Admin Email"
              name="adminEmail"
              placeholder="admin@example.com"
              value={draft.adminEmail}
              onChange={(e) => set({ adminEmail: e.target.value })}
              required
              showError={false}
            />
            {errors.adminEmail && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.adminEmail}</p>}
          </div>
          <InputField
            label="WhatsApp Number"
            name="adminWhatsappNumber"
            placeholder="e.g. +91 98765 43210"
            value={draft.adminWhatsappNumber}
            onChange={(e) => set({ adminWhatsappNumber: e.target.value })}
          />
          <InputField
            label="Phone Number"
            name="adminPhoneNumber"
            placeholder="e.g. +91 98765 43210"
            value={draft.adminPhoneNumber}
            onChange={(e) => set({ adminPhoneNumber: e.target.value })}
          />
        </div>
        <div className="mt-4">
          <InputField
            label="Address"
            name="adminAddress"
            placeholder="Street address"
            value={draft.adminAddress}
            onChange={(e) => set({ adminAddress: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <InputField
            label="City"
            name="adminCity"
            value={draft.adminCity}
            onChange={(e) => set({ adminCity: e.target.value })}
          />
          <InputField
            label="State"
            name="adminState"
            value={draft.adminState}
            onChange={(e) => set({ adminState: e.target.value })}
          />
          <InputField
            label="Pincode"
            name="adminPincode"
            value={draft.adminPincode}
            onChange={(e) => set({ adminPincode: e.target.value })}
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Company Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <InputField
            label="Company Name"
            name="companyName"
            placeholder="e.g. Hutaib Tailoring Materials"
            value={draft.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
          />
        </div>

        <div className="mt-4 flex items-start gap-4">
          {draft.companyLogo?.url && !(draft.companyLogo instanceof File) && (
            <Avatar src={draft.companyLogo.url} name={draft.companyName} shape="square" size="xl" />
          )}
          <div className="flex-1">
            <FileUpload
              label={draft.companyLogo?.url ? 'Replace Logo' : 'Company Logo'}
              accept="image/*"
              maxSize={5 * 1024 * 1024}
              onFilesSelected={(files) => set({ companyLogo: files[0] || (draft.companyLogo?.url ? draft.companyLogo : null) })}
              helperText="JPG, JPEG or PNG. Up to 5MB."
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Social Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <InputField
            label="Instagram ID"
            name="instagramId"
            placeholder="e.g. @yourbrand"
            value={draft.instagramId}
            onChange={(e) => set({ instagramId: e.target.value })}
          />
          <InputField
            label="Facebook ID"
            name="facebookId"
            placeholder="e.g. yourbrand"
            value={draft.facebookId}
            onChange={(e) => set({ facebookId: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
};

export default GeneralInfoSection;

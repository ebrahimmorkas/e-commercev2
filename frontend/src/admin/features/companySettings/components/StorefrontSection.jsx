import Switch from '../../../../components/common/Switch';
import theme from '../theme/theme';
import CatalogueCard from './CatalogueCard';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {Object|null} props.companyMaster - CompanyMaster entitlement flags (isTaxRegistrationFeatureOn gates the signup switch)
 */
const StorefrontSection = ({ draft, onChange, companyMaster, catalogue, settingsExist }) => {
  const set = (patch) => onChange(patch);

  // Only the CompanyMaster half of the gate is visible here, same accepted limitation as
  // the Payment & Bank tab - the server checks WebsiteMaster too when signup is used.
  const flagOn = (flag) => companyMaster?.[flag] !== false;
  const taxRegistrationEntitled = !!companyMaster?.isTaxRegistrationFeatureOn;

  return (
    <div className="space-y-4">
      {companyMaster?.isCatalogueDownloadFeatureOn && <CatalogueCard catalogue={catalogue} settingsExist={settingsExist} />}

      {flagOn('isAnnouncementFeatureOn') && (
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <Switch
          label="Show Announcements"
          description="Display the announcement bar on the storefront."
          checked={draft.showAnnouncements}
          onChange={(e) => set({ showAnnouncements: e.target.checked })}
          color={theme.switch.color}
        />
        {draft.showAnnouncements && (
          <Switch
            label="Rotate Announcements"
            description="Cycle through multiple active announcements instead of showing one at a time."
            checked={draft.isAnnouncementRotationOn}
            onChange={(e) => set({ isAnnouncementRotationOn: e.target.checked })}
            color={theme.switch.color}
          />
        )}
      </div>
      )}

      {flagOn('isBannerFeatureOn') && (
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <Switch
          label="Show Banners"
          description="Display promotional banners on the storefront home page."
          checked={draft.showBanners}
          onChange={(e) => set({ showBanners: e.target.checked })}
          color={theme.switch.color}
        />
        {draft.showBanners && (
          <Switch
            label="Rotate Banners"
            description="Cycle through multiple active banners instead of showing only the default one."
            checked={draft.isBannerRotationOn}
            onChange={(e) => set({ isBannerRotationOn: e.target.checked })}
            color={theme.switch.color}
          />
        )}
      </div>
      )}

      {/* Hidden when the feature isn't on for this account - unless it is still
          switched on in the saved settings, so it can be switched off. */}
      {(taxRegistrationEntitled || draft.isTaxRegistrationOnSignupEnabled) && (
        <div className="border border-gray-200 rounded-lg p-3">
          <Switch
            label="Ask for Tax Registration at Signup"
            description="Show an optional 'I am tax registered' checkbox on the customer signup form. When a customer ticks it, they must also enter a Business Full Name and a 15-digit TRN."
            checked={draft.isTaxRegistrationOnSignupEnabled}
            onChange={(e) => set({ isTaxRegistrationOnSignupEnabled: e.target.checked })}
            color={theme.switch.color}
          />
        </div>
      )}

      {flagOn('isReviewFeatureOn') && (
      <div className="border border-gray-200 rounded-lg p-3">
        <Switch
          label="Show Reviews to Customers"
          description="Display product reviews/ratings on the storefront."
          checked={draft.showReviewsToCustomers}
          onChange={(e) => set({ showReviewsToCustomers: e.target.checked })}
          color={theme.switch.color}
        />
      </div>
      )}
    </div>
  );
};

export default StorefrontSection;

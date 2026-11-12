import Switch from '../../../../components/common/Switch';
import InputField from '../../../../components/common/InputField';
import FileUpload from '../../../../components/common/FileUpload';
import TextArea from '../../../../components/common/TextArea';
import Avatar from '../../../../components/common/Avatar';
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
            description="On: cycles through all active announcements. Off: shows only the first one."
            checked={draft.isAnnouncementRotationOn}
            onChange={(e) => set({ isAnnouncementRotationOn: e.target.checked })}
            color={theme.switch.color}
          />
        )}
      </div>
      )}

      {/* Both CompanyMaster (this account) and WebsiteMaster (platform) must allow the blog; only the first is visible here. */}
      {companyMaster?.isBlogFeatureOn === true && (
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <Switch
          label="Show Blog"
          description="Add a Blog link to the storefront menu, beside Download Catalogue. It appears once at least one post is published."
          checked={draft.showBlog}
          onChange={(e) => set({ showBlog: e.target.checked })}
          color={theme.switch.color}
        />
        {draft.showBlog && (
          <div>
            <InputField
              className="w-full"
              label="Menu Label"
              maxLength={20}
              placeholder="Blog"
              value={draft.blogNavLabel}
              onChange={(e) => set({ blogNavLabel: e.target.value })}
            />
            <p className={`mt-1 text-xs ${theme.text.muted}`}>
              The text shown in the storefront menu, for example "Blog", "News" or "Journal".
            </p>
          </div>
        )}
      </div>
      )}

      {companyMaster?.isShowingPartnerCertificateFeatureOn === true && (
        <div className="border border-gray-200 rounded-lg p-3">
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
          <div className="mt-4">
            <InputField
              className="w-full"
              label="Home Page Badge"
              maxLength={100}
              placeholder="e.g. Preciosa® Crystals Authorized Partner"
              value={draft.partnerBadgeText}
              onChange={(e) => set({ partnerBadgeText: e.target.value })}
            />
            <p className={`mt-1 text-xs ${theme.text.muted}`}>
              The pill shown above the home page banner heading, and the label on the mobile certificate strip. Leave blank to hide the pill.
            </p>
          </div>
          <div className="mt-4">
            <TextArea
              label="Certificate Text"
              name="partnerCertificateText"
              placeholder="e.g. Authorized partner since 2020"
              rows={3}
              maxLength={300}
              showCharCount
              value={draft.partnerCertificateText}
              onChange={(e) => set({ partnerCertificateText: e.target.value })}
            />
            <p className={`mt-1 text-xs ${theme.text.muted}`}>
              Shown on the storefront home page, just below the banner: beside the certificate on desktop, and under an "Authorized Partner" label with a "View certificate" link on mobile.
            </p>
          </div>
        </div>
      )}

      {/* Floating social buttons: each needs its CompanyMaster flag here (WebsiteMaster is checked by the server). */}
      {['isFloatingWhatsappFeatureOn', 'isFloatingInstagramFeatureOn', 'isFloatingFacebookFeatureOn'].some((f) => companyMaster?.[f] === true) && (
      <div className="border border-gray-200 rounded-lg p-3 space-y-4">
        <div>
          <h3 className={`text-sm font-semibold ${theme.text.heading}`}>Floating Social Buttons</h3>
          <p className={`mt-0.5 text-xs ${theme.text.muted}`}>
            Small icons fixed at the bottom-right of every storefront page. They fade while the page scrolls.
          </p>
        </div>
        {companyMaster?.isFloatingWhatsappFeatureOn === true && (
          <div className="space-y-2">
            <Switch
              label="WhatsApp"
              description="Opens a WhatsApp chat with the number below."
              checked={draft.showFloatingWhatsapp}
              onChange={(e) => set({ showFloatingWhatsapp: e.target.checked })}
              color={theme.switch.color}
            />
            {draft.showFloatingWhatsapp && (
              <InputField
                className="w-full"
                label="WhatsApp Number"
                placeholder="e.g. 919876543210 (with country code)"
                value={draft.whatsappNumber}
                onChange={(e) => set({ whatsappNumber: e.target.value })}
              />
            )}
          </div>
        )}
        {companyMaster?.isFloatingInstagramFeatureOn === true && (
          <Switch
            label="Instagram"
            description="Links to the Instagram ID set in the General tab (Social Links)."
            checked={draft.showFloatingInstagram}
            onChange={(e) => set({ showFloatingInstagram: e.target.checked })}
            color={theme.switch.color}
          />
        )}
        {companyMaster?.isFloatingFacebookFeatureOn === true && (
          <Switch
            label="Facebook"
            description="Links to the Facebook ID set in the General tab (Social Links)."
            checked={draft.showFloatingFacebook}
            onChange={(e) => set({ showFloatingFacebook: e.target.checked })}
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
            description="On: cycles through all active banners. Off: shows only the default one."
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

      {flagOn('isProductReviewFeatureOn') && (
      <div className="border border-gray-200 rounded-lg p-3 space-y-3">
        <Switch
          label="Show Reviews to Customers"
          description="Display product reviews/ratings on the storefront."
          checked={draft.showReviewsToCustomers}
          onChange={(e) => set({ showReviewsToCustomers: e.target.checked })}
          color={theme.switch.color}
        />
        <div>
          <InputField
            type="number"
            label="Reviews Allowed per Customer per Product"
            min={1}
            max={100}
            step={1}
            placeholder="No limit"
            value={draft.maxReviewsPerCustomerPerProduct}
            onChange={(e) => set({ maxReviewsPerCustomerPerProduct: e.target.value })}
          />
          <p className={`mt-1 text-xs ${theme.text.muted}`}>
            Each review needs its own delivered order. 1 = one review per product, which the customer can edit later. Leave blank for no limit.
          </p>
        </div>
      </div>
      )}
    </div>
  );
};

export default StorefrontSection;

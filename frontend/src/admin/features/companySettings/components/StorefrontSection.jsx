import Switch from '../../../../components/common/Switch';
import theme from '../theme/theme';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const StorefrontSection = ({ draft, onChange }) => {
  const set = (patch) => onChange(patch);

  return (
    <div className="space-y-4">
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

      <div className="border border-gray-200 rounded-lg p-3">
        <Switch
          label="Show Reviews to Customers"
          description="Display product reviews/ratings on the storefront."
          checked={draft.showReviewsToCustomers}
          onChange={(e) => set({ showReviewsToCustomers: e.target.checked })}
          color={theme.switch.color}
        />
      </div>
    </div>
  );
};

export default StorefrontSection;

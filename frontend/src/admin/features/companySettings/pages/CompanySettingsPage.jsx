import { useState } from 'react';
import useSessionStorageState from '../../../../hooks/useSessionStorageState';
import Card from '../../../../components/common/Card';
import Tabs from '../../../../components/common/Tabs';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import { useCompanySettings } from '../hooks/useCompanySettings';
import { emptyDraft, mapApiSettingsToDraft, buildSavePayload, invalidEmails } from '../utils/companySettingsDraft';
import { useToast } from '../../../../components/common/Toast';
import GeneralInfoSection from '../components/GeneralInfoSection';
import PoliciesSection from '../components/PoliciesSection';
import StorefrontSection from '../components/StorefrontSection';
import ProductSection from '../components/ProductSection';
import CartOrderSection from '../components/CartOrderSection';
import PaymentBankSection from '../components/PaymentBankSection';
import EmailSection from '../components/EmailSection';
import FreeCashSection from '../components/FreeCashSection';
import DiscountFreeCashSection from '../components/DiscountFreeCashSection';
import { useEmailContent } from '../hooks/useEmailContent';
import InvoiceSection from '../components/InvoiceSection';
import AbandonedCartSection from '../components/AbandonedCartSection';
import ShippingSection from '../components/ShippingSection';
import theme from '../theme/theme';

/**
 * The vendor's single CompanySettings document, edited as one page split
 * into tabs - there's exactly one record per vendor (create the first time,
 * update every time after), so this deliberately isn't a list+modal CRUD
 * page like Brands/Banners/Free Cash.
 */
const CompanySettingsPage = () => {
  const { settings, exists, companyMaster, orderSteps, loading, error, saving, save } = useCompanySettings();
  // Email attachments/images - saved on their own, never through the draft/Save.
  const emailContent = useEmailContent(settings);
  const [draft, setDraft] = useState(emptyDraft());
  // Persisted so a refresh lands back on the same tab.
  const [storedTab, setActiveTab] = useSessionStorageState('ecom.admin.companySettings.tab', 'general');
  const [formErrors, setFormErrors] = useState({});
  const toast = useToast();

  // Load the form from the settings whenever they change (loaded / saved).
  const [draftFor, setDraftFor] = useState(null);
  if (settings && draftFor !== settings) {
    setDraftFor(settings);
    setDraft(mapApiSettingsToDraft(settings));
  }

  const patchDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  // Admin name/email are only enforced while the General tab (where they live)
  // is open; from any other tab a blank pair is left out of the save instead.
  const validate = () => {
    const nextErrors = {};
    if (activeTab === 'general') {
      if (!draft.adminName.trim()) nextErrors.adminName = 'Admin name is required';
      if (!draft.adminEmail.trim()) nextErrors.adminEmail = 'Admin email is required';
    }
    if (isInvoiceTabOn && draft.taxRegistrationNumber && !/^\d{15}$/.test(draft.taxRegistrationNumber)) {
      nextErrors.taxRegistrationNumber = 'TRN must be exactly 15 digits';
    }
    if (invalidEmails(draft.ccList).length || invalidEmails(draft.bccList).length) {
      nextErrors.emailLists = 'Fix the invalid CC/BCC email addresses';
    }
    setFormErrors(nextErrors);
    return nextErrors;
  };

  const handleSave = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      if (errors.adminName || errors.adminEmail) {
        toast.error('Not saved - please fill in the fields marked in red on the General tab.');
      } else if (errors.taxRegistrationNumber) {
        setActiveTab('invoice');
        toast.error('Not saved - please fix the fields marked in red on the Invoice tab.');
      } else {
        setActiveTab('email');
        toast.error(`Not saved - ${errors.emailLists}.`);
      }
      return;
    }
    // The very first save creates the record, and the backend needs the admin
    // name/email for that - so it can only happen from the General tab.
    if (!exists && (!draft.adminName.trim() || !draft.adminEmail.trim())) {
      setActiveTab('general');
      setFormErrors({
        adminName: draft.adminName.trim() ? undefined : 'Admin name is required',
        adminEmail: draft.adminEmail.trim() ? undefined : 'Admin email is required',
      });
      toast.error('Fill in the Admin Name and Admin Email on the General tab to create your settings.');
      return;
    }
    const { fields, files } = buildSavePayload(draft, { bankTransferEnabled: !!companyMaster?.showPaymentQRCodeAndBankDetails });
    if (!fields.adminName?.trim()) delete fields.adminName;
    if (!fields.adminEmail?.trim()) delete fields.adminEmail;
    await save(fields, files);
  };

  // A feature switched off in CompanyMaster/WebsiteMaster is hidden here
  // (companyMaster flags already hold the combined value). A vendor's own
  // Company Settings toggle is different: it stays visible so they can turn it
  // back on. Unknown (master data not loaded) shows everything.
  const flagOn = (flag) => companyMaster?.[flag] !== false;
  const isInvoiceTabOn = flagOn('isPDFDownloadableFeatureOn');

  const sectionProps = { draft, onChange: patchDraft };
  // The master email switch (WebsiteMaster AND CompanyMaster); before the
  // settings exist only CompanyMaster is known.
  const isEmailOn = settings?.emailFeatureAccess
    ? settings.emailFeatureAccess.isEmailOn !== false
    : companyMaster?.isSendingEmailFeatureOn !== false;

  const tabs = [
    { key: 'general', label: 'General', content: <GeneralInfoSection {...sectionProps} errors={formErrors} /> },
    { key: 'policies', label: 'Policies', content: <PoliciesSection {...sectionProps} /> },
    { key: 'storefront', label: 'Storefront', content: <StorefrontSection {...sectionProps} companyMaster={companyMaster} catalogue={settings?.catalogue || null} settingsExist={exists} /> },
    { key: 'product', label: 'Product', content: <ProductSection {...sectionProps} /> },
    { key: 'cartOrder', label: 'Cart & Order', content: <CartOrderSection {...sectionProps} orderSteps={orderSteps} companyMaster={companyMaster} /> },
    { key: 'payment', label: 'Payment & Bank', content: <PaymentBankSection {...sectionProps} companyMaster={companyMaster} /> },
    // Email and its Discount/Free Cash email settings only while email is on
    // for the account (the master isSendingEmailFeatureOn switch).
    ...(isEmailOn
      ? [
          {
            key: 'email',
            label: 'Email',
            content: (
              <EmailSection
                {...sectionProps}
                access={settings?.emailFeatureAccess || null}
                companyMaster={companyMaster}
                exists={exists}
                emailContent={emailContent}
              />
            ),
          },
        ]
      : []),
    ...(isInvoiceTabOn
      ? [{ key: 'invoice', label: 'Invoice', content: <InvoiceSection {...sectionProps} errors={formErrors} /> }]
      : []),
    ...(flagOn('isFreeCashFeatureOn')
      ? [{ key: 'freeCash', label: 'Free Cash', content: <FreeCashSection {...sectionProps} companyMaster={companyMaster} /> }]
      : []),
    ...(isEmailOn && (flagOn('isDiscountFeatureOn') || flagOn('isFreeCashFeatureOn'))
      ? [{ key: 'discountFreeCash', label: 'Discount and Free Cash', content: <DiscountFreeCashSection {...sectionProps} /> }]
      : []),
    ...(flagOn('isAbondonedCartFeatureOn')
      ? [{ key: 'abandonedCart', label: 'Abandoned Cart', content: <AbandonedCartSection {...sectionProps} /> }]
      : []),
    // Hidden entirely unless the platform has enabled shipping pricing for this vendor.
    ...(companyMaster?.isShippingPriceFeatureOn
      ? [{ key: 'shipping', label: 'Shipping', content: <ShippingSection companyMaster={companyMaster} /> }]
      : []),
  ];

  // A stored tab that isn't available for this vendor (e.g. Email off) falls back to the first.
  const activeTab = tabs.some((t) => t.key === storedTab) ? storedTab : tabs[0].key;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Card
        title={<span className="font-bold">Company Settings</span>}
        subtitle={exists ? 'Manage your storefront, orders, payments and more.' : 'Set up your company profile to get started.'}
        // Shipping saves through its own button (separate endpoint), so this one would only mislead there.
        headerActions={
          activeTab === 'shipping' ? null : (
            <Button variant={theme.button.primary} onClick={handleSave} loading={saving}>
              {exists ? 'Save Changes' : 'Create Settings'}
            </Button>
          )
        }
      >
        {error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>
            {error}
          </p>
        )}
        {!exists && !error && (
          <p className={`mb-4 text-sm ${theme.alert.info.text} ${theme.alert.info.background} border ${theme.alert.info.border} rounded-lg px-4 py-2`}>
            You haven't set up company settings yet. Fill in at least the Admin Name and Admin Email below, then save to create them.
          </p>
        )}

        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} variant="line" />

      </Card>
    </div>
  );
};

export default CompanySettingsPage;

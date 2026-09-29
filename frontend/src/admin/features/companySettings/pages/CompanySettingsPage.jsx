import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('general');
  const [formErrors, setFormErrors] = useState({});
  const toast = useToast();

  // Load the form from the settings whenever they change (loaded / saved).
  const [draftFor, setDraftFor] = useState(null);
  if (settings && draftFor !== settings) {
    setDraftFor(settings);
    setDraft(mapApiSettingsToDraft(settings));
  }

  const patchDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const validate = () => {
    const nextErrors = {};
    if (!draft.adminName.trim()) nextErrors.adminName = 'Admin name is required';
    if (!draft.adminEmail.trim()) nextErrors.adminEmail = 'Admin email is required';
    if (draft.taxRegistrationNumber && !/^\d{15}$/.test(draft.taxRegistrationNumber)) {
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
      // Jump to the tab that holds the first problem, and say so - the jump alone is easy to miss.
      if (errors.adminName || errors.adminEmail) {
        setActiveTab('general');
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
    const { fields, files } = buildSavePayload(draft, { bankTransferEnabled: !!companyMaster?.showPaymentQRCodeAndBankDetails });
    await save(fields, files);
  };

  const sectionProps = { draft, onChange: patchDraft };
  // The master email switch (WebsiteMaster AND CompanyMaster); before the
  // settings exist only CompanyMaster is known.
  const isEmailOn = settings?.emailFeatureAccess
    ? settings.emailFeatureAccess.isEmailOn !== false
    : companyMaster?.isSendingEmailFeatureOn !== false;

  const tabs = [
    { key: 'general', label: 'General', content: <GeneralInfoSection {...sectionProps} errors={formErrors} /> },
    { key: 'policies', label: 'Policies', content: <PoliciesSection {...sectionProps} /> },
    { key: 'storefront', label: 'Storefront', content: <StorefrontSection {...sectionProps} companyMaster={companyMaster} /> },
    { key: 'product', label: 'Product', content: <ProductSection {...sectionProps} /> },
    { key: 'cartOrder', label: 'Cart & Order', content: <CartOrderSection {...sectionProps} orderSteps={orderSteps} /> },
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
    { key: 'invoice', label: 'Invoice', content: <InvoiceSection {...sectionProps} errors={formErrors} /> },
    { key: 'freeCash', label: 'Free Cash', content: <FreeCashSection {...sectionProps} /> },
    ...(isEmailOn
      ? [{ key: 'discountFreeCash', label: 'Discount and Free Cash', content: <DiscountFreeCashSection {...sectionProps} /> }]
      : []),
    { key: 'abandonedCart', label: 'Abandoned Cart', content: <AbandonedCartSection {...sectionProps} /> },
    // Hidden entirely unless the platform has enabled shipping pricing for this vendor.
    ...(companyMaster?.isShippingPriceFeatureOn
      ? [{ key: 'shipping', label: 'Shipping', content: <ShippingSection companyMaster={companyMaster} /> }]
      : []),
  ];

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
        headerActions={
          <Button variant={theme.button.primary} onClick={handleSave} loading={saving}>
            {exists ? 'Save Changes' : 'Create Settings'}
          </Button>
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

        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} variant="pills" />

        <div className="flex justify-end pt-6 mt-6 border-t border-gray-100">
          <Button variant={theme.button.primary} onClick={handleSave} loading={saving}>
            {exists ? 'Save Changes' : 'Create Settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CompanySettingsPage;

import { useEffect, useState } from 'react';
import Card from '../../../../components/common/Card';
import Tabs from '../../../../components/common/Tabs';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import { useCompanySettings } from '../hooks/useCompanySettings';
import { emptyDraft, mapApiSettingsToDraft, buildSavePayload } from '../utils/companySettingsDraft';
import GeneralInfoSection from '../components/GeneralInfoSection';
import PoliciesSection from '../components/PoliciesSection';
import StorefrontSection from '../components/StorefrontSection';
import ProductSection from '../components/ProductSection';
import CartOrderSection from '../components/CartOrderSection';
import PaymentBankSection from '../components/PaymentBankSection';
import EmailSection from '../components/EmailSection';
import FreeCashSection from '../components/FreeCashSection';
import AbandonedCartSection from '../components/AbandonedCartSection';
import theme from '../theme/theme';

/**
 * The vendor's single CompanySettings document, edited as one page split
 * into tabs - there's exactly one record per vendor (create the first time,
 * update every time after), so this deliberately isn't a list+modal CRUD
 * page like Brands/Banners/Free Cash.
 */
const CompanySettingsPage = () => {
  const { settings, exists, companyMaster, loading, error, saving, save } = useCompanySettings();
  const [draft, setDraft] = useState(emptyDraft());
  const [activeTab, setActiveTab] = useState('general');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (settings) setDraft(mapApiSettingsToDraft(settings));
  }, [settings]);

  const patchDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const validate = () => {
    const nextErrors = {};
    if (!draft.adminName.trim()) nextErrors.adminName = 'Admin name is required';
    if (!draft.adminEmail.trim()) nextErrors.adminEmail = 'Admin email is required';
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      setActiveTab('general');
      return;
    }
    const { fields, files } = buildSavePayload(draft, { bankTransferEnabled: !!companyMaster?.showPaymentQRCodeAndBankDetails });
    await save(fields, files);
  };

  const sectionProps = { draft, onChange: patchDraft };

  const tabs = [
    { key: 'general', label: 'General', content: <GeneralInfoSection {...sectionProps} errors={formErrors} /> },
    { key: 'policies', label: 'Policies', content: <PoliciesSection {...sectionProps} /> },
    { key: 'storefront', label: 'Storefront', content: <StorefrontSection {...sectionProps} companyMaster={companyMaster} /> },
    { key: 'product', label: 'Product', content: <ProductSection {...sectionProps} /> },
    { key: 'cartOrder', label: 'Cart & Order', content: <CartOrderSection {...sectionProps} /> },
    { key: 'payment', label: 'Payment & Bank', content: <PaymentBankSection {...sectionProps} companyMaster={companyMaster} /> },
    { key: 'email', label: 'Email', content: <EmailSection {...sectionProps} /> },
    { key: 'freeCash', label: 'Free Cash', content: <FreeCashSection {...sectionProps} /> },
    { key: 'abandonedCart', label: 'Abandoned Cart', content: <AbandonedCartSection {...sectionProps} /> },
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

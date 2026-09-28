import { useStorefrontCompanySettings } from '../hooks/useStorefrontCompanySettings';
import PolicyContent from '../components/PolicyContent';
import Spinner from '../../../../components/common/Spinner';

/**
 * Company Settings > Policies > "How should these open?" set to Dedicated
 * page - full-page, shareable/linkable view of one policy field.
 *
 * @param {{key: string, label: string}} props.link
 * @param {() => void} props.onBack
 */
const PolicyPage = ({ link, onBack }) => {
  const { companySettings, loading } = useStorefrontCompanySettings();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-amber-600 hover:text-amber-700 mb-6 cursor-pointer"
      >
        &larr; Back to Home
      </button>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{link.label}</h1>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : (
        <PolicyContent html={companySettings?.[link.key]} />
      )}
    </div>
  );
};

export default PolicyPage;

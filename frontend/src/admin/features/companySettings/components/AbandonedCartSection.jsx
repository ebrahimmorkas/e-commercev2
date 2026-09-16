import Switch from '../../../../components/common/Switch';
import InputField from '../../../../components/common/InputField';
import theme from '../theme/theme';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 */
const AbandonedCartSection = ({ draft, onChange }) => {
  const set = (patch) => onChange(patch);

  return (
    <div className="space-y-4">
      <div>
        <InputField
          type="number"
          label="Reflect Cart as Abandoned After (minutes)"
          min={1}
          max={10080}
          value={draft.timeForAbondonedCartReflection}
          onChange={(e) => set({ timeForAbondonedCartReflection: e.target.value })}
        />
        <p className={`mt-1 text-xs ${theme.text.muted}`}>
          Minutes of inactivity, measured from the last time a product was added to the cart.
        </p>
      </div>

      <Switch
        label="Show Abandoned Carts for Logged-in Users Only"
        checked={draft.abondonedCartOnlyForLoggedInUsers}
        onChange={(e) => set({ abondonedCartOnlyForLoggedInUsers: e.target.checked })}
        color={theme.switch.color}
      />
    </div>
  );
};

export default AbandonedCartSection;

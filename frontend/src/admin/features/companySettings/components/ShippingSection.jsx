import { useEffect, useMemo, useState } from 'react';
import Switch from '../../../../components/common/Switch';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import Alert from '../../../../components/common/Alert';
import Spinner from '../../../../components/common/Spinner';
import { useShippingSettings } from '../hooks/useShippingSettings';
import {
  SHIPPING_STEPS,
  CATEGORY_CHARGE_MODE_OPTIONS,
  CATEGORY_AGGREGATION_OPTIONS,
  RULE_CONFIG,
  mapApiShippingToDraft,
  buildShippingPayload,
  validateShippingDraft,
} from '../utils/shippingSettingsDraft';
import theme from '../theme/theme';

/**
 * Editable list of "<picker> -> price" rows (category/country/state/city
 * rules use a Dropdown, zip code rules a text field), with add/remove.
 */
const RuleRows = ({ rows, idField, options, idLabel, idPlaceholder, onChange }) => {
  const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, { [idField]: '', price: '' }]);

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
          {options ? (
            <Dropdown
              label={idLabel}
              options={options}
              value={row[idField]}
              onChange={(value) => update(index, { [idField]: value })}
              placeholder={idPlaceholder}
              searchable
            />
          ) : (
            <InputField
              label={idLabel}
              placeholder={idPlaceholder}
              maxLength={20}
              value={row[idField]}
              onChange={(e) => update(index, { [idField]: e.target.value })}
            />
          )}
          <InputField
            type="number"
            label="Shipping price"
            min={0}
            placeholder="0"
            value={row.price}
            onChange={(e) => update(index, { price: e.target.value })}
          />
          <Button variant={theme.button.danger} size="sm" onClick={() => remove(index)} disabled={rows.length === 1}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant={theme.button.secondary} size="sm" onClick={add}>
        + Add another
      </Button>
    </div>
  );
};

const WeightRows = ({ rows, onChange }) => {
  const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, { minWeight: '', maxWeight: '', price: '' }]);

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <InputField
            type="number"
            label="From weight"
            min={0}
            value={row.minWeight}
            onChange={(e) => update(index, { minWeight: e.target.value })}
          />
          <InputField
            type="number"
            label="To weight (blank = and above)"
            min={0}
            value={row.maxWeight}
            onChange={(e) => update(index, { maxWeight: e.target.value })}
          />
          <InputField
            type="number"
            label="Shipping price"
            min={0}
            value={row.price}
            onChange={(e) => update(index, { price: e.target.value })}
          />
          <Button variant={theme.button.danger} size="sm" onClick={() => remove(index)} disabled={rows.length === 1}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant={theme.button.secondary} size="sm" onClick={add}>
        + Add weight range
      </Button>
    </div>
  );
};

/**
 * Shipping price settings for the vendor. Shown as a chain of yes/no
 * questions - answering "yes" to one stops the chain and shows that method's
 * settings; "no" moves on to the next question. Only questions for methods
 * the vendor has been granted (CompanyMaster.allowedShippingPriceMethods) are
 * offered. Saved through its own endpoint (not the company-settings form), so
 * it has its own Save button.
 *
 * @param {Object} props.companyMaster - CompanyMaster entitlement flags.
 */
const ShippingSection = ({ companyMaster }) => {
  const shipping = useShippingSettings(companyMaster);
  const [draft, setDraft] = useState(() => mapApiShippingToDraft(null));
  const [problems, setProblems] = useState([]);

  const steps = useMemo(() => {
    const allowed = companyMaster?.allowedShippingPriceMethods || [];
    return allowed.length === 0 ? SHIPPING_STEPS : SHIPPING_STEPS.filter((s) => allowed.includes(s.method));
  }, [companyMaster]);

  // Load the saved settings into the draft; if the saved method is no longer
  // allowed for this vendor, fall back to the first question they can answer.
  useEffect(() => {
    if (shipping.loading) return;
    const next = mapApiShippingToDraft(shipping.settings);
    if (steps.length > 0 && !steps.some((s) => s.method === next.method)) next.method = steps[0].method;
    setDraft(next);
  }, [shipping.settings, shipping.loading, steps]);

  const patch = (changes) => setDraft((prev) => ({ ...prev, ...changes }));
  const selectedIndex = steps.findIndex((s) => s.method === draft.method);

  const handleSwitch = (index, checked) => {
    setProblems([]);
    if (checked) {
      patch({ method: steps[index].method });
    } else if (index < steps.length - 1) {
      patch({ method: steps[index + 1].method });
    }
  };

  const handleSave = async () => {
    const found = validateShippingDraft(draft);
    setProblems(found);
    if (found.length > 0) return;
    await shipping.save(buildShippingPayload(draft));
  };

  const renderConfig = (method) => {
    switch (method) {
      case 'FREE':
        return <p className={`text-sm ${theme.text.body}`}>Shipping is free for every order. No shipping price is calculated.</p>;
      case 'FIXED':
        return (
          <InputField
            type="number"
            label="Fixed shipping price"
            placeholder="e.g. 49"
            min={0}
            value={draft.fixedPrice}
            onChange={(e) => patch({ fixedPrice: e.target.value })}
          />
        );
      case 'CUSTOM':
        return (
          <p className={`text-sm ${theme.text.body}`}>
            You will enter the shipping price manually when you confirm each order. Customers see &quot;To be confirmed&quot; until then.
          </p>
        );
      case 'FREE_ABOVE':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField
              type="number"
              label="Shipping is free when the order is at or above"
              min={0}
              value={draft.freeAboveThreshold}
              onChange={(e) => patch({ freeAboveThreshold: e.target.value })}
            />
            <InputField
              type="number"
              label="Shipping price when the order is below that"
              min={0}
              value={draft.freeAboveFallbackPrice}
              onChange={(e) => patch({ freeAboveFallbackPrice: e.target.value })}
            />
          </div>
        );
      case 'WEIGHT':
        return (
          <div className="space-y-3">
            <Dropdown
              label="Weight unit"
              options={shipping.weightOptions}
              value={draft.weightUnit}
              onChange={(value) => patch({ weightUnit: value })}
              placeholder={shipping.weightOptions.length === 0 ? 'No weight units assigned to your account' : 'Select a unit'}
              helperText="The total weight of the order is matched to the ranges below, in this unit."
            />
            <WeightRows rows={draft.weightBrackets} onChange={(rows) => patch({ weightBrackets: rows })} />
            <InputField
              type="number"
              label="Price for any other weight"
              placeholder="0"
              min={0}
              value={draft.weightRestPrice}
              onChange={(e) => patch({ weightRestPrice: e.target.value })}
            />
          </div>
        );
      case 'CATEGORY':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Dropdown
                label="Charge"
                options={CATEGORY_CHARGE_MODE_OPTIONS}
                value={draft.categoryChargeMode}
                onChange={(value) => patch({ categoryChargeMode: value })}
              />
              <Dropdown
                label="When an order has several categories"
                options={CATEGORY_AGGREGATION_OPTIONS}
                value={draft.categoryAggregation}
                onChange={(value) => patch({ categoryAggregation: value })}
              />
            </div>
            <RuleRows
              rows={draft.categoryRules}
              idField="categoryId"
              idLabel="Category"
              idPlaceholder="Select a category"
              options={shipping.categoryOptions}
              onChange={(rows) => patch({ categoryRules: rows })}
            />
            <InputField
              type="number"
              label={RULE_CONFIG.CATEGORY.restLabel}
              placeholder="0"
              min={0}
              value={draft.categoryRestPrice}
              onChange={(e) => patch({ categoryRestPrice: e.target.value })}
            />
          </div>
        );
      case 'COUNTRY':
      case 'STATE':
      case 'CITY':
      case 'ZIP': {
        const config = RULE_CONFIG[method];
        const optionsByMethod = { COUNTRY: shipping.countryOptions, STATE: shipping.stateOptions, CITY: shipping.cityOptions, ZIP: null };
        const noun = config.noun.charAt(0).toUpperCase() + config.noun.slice(1);
        return (
          <div className="space-y-3">
            <RuleRows
              rows={draft[config.rulesKey]}
              idField={config.idField}
              idLabel={noun}
              idPlaceholder={method === 'ZIP' ? 'e.g. 400001' : `Select a ${config.noun}`}
              options={optionsByMethod[method]}
              onChange={(rows) => patch({ [config.rulesKey]: rows })}
            />
            <InputField
              type="number"
              label={config.restLabel}
              placeholder="0"
              min={0}
              value={draft[config.restKey]}
              onChange={(e) => patch({ [config.restKey]: e.target.value })}
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  if (shipping.loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (steps.length === 0 || selectedIndex === -1) {
    return <p className={`text-sm ${theme.text.body}`}>No shipping price options are available for your account.</p>;
  }

  return (
    <div className="space-y-4">
      {shipping.error && <Alert variant="error">{shipping.error}</Alert>}
      {!shipping.exists && !shipping.error && (
        <Alert variant="info">Shipping isn&apos;t set up yet. Answer the questions below and save.</Alert>
      )}
      {problems.length > 0 && (
        <Alert variant="error" title="Please fix the following">
          <ul className="list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}

      {steps.slice(0, selectedIndex + 1).map((step, index) => {
        const isSelected = index === selectedIndex;
        const isLastStep = index === steps.length - 1;
        return (
          <div key={step.method} className="border border-gray-200 rounded-lg p-3 space-y-3">
            <Switch
              label={step.question}
              description={isSelected && isLastStep && steps.length > 1 ? 'This is the last option. Turn on an earlier question to choose a different one.' : ''}
              checked={isSelected}
              disabled={isSelected && isLastStep}
              onChange={(e) => handleSwitch(index, e.target.checked)}
              color={theme.switch.color}
            />
            {isSelected && renderConfig(step.method)}
          </div>
        );
      })}

      <div className="flex justify-end">
        <Button variant={theme.button.primary} onClick={handleSave} loading={shipping.saving}>
          {shipping.exists ? 'Save Shipping Settings' : 'Create Shipping Settings'}
        </Button>
      </div>
    </div>
  );
};

export default ShippingSection;

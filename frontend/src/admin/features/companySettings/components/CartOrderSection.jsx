import Switch from '../../../../components/common/Switch';
import Dropdown from '../../../../components/common/DropDown';
import theme from '../theme/theme';

// A saved step code that isn't in the store's current workflow (the platform
// assigned a different one) is ignored by the server - say so.
const staleStepText = (code, steps) =>
  code && !steps.some((step) => step.code === code)
    ? `The saved step "${code}" is not one of your current order steps, so it is ignored. Pick a step again.`
    : undefined;

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {{ steps: Array<{ code: string, name: string, sequence: number }>, lastStepCode: string|null, isDeliveryAgentAccessOn: boolean }} props.orderSteps
 *   - the order workflow assigned to this store (GET /company-settings/order-steps), in sequence
 */
const CartOrderSection = ({ draft, onChange, orderSteps, companyMaster = null }) => {
  const set = (patch) => onChange(patch);

  const isReturnOn = companyMaster?.isReturnFeatureOn !== false;
  const isExchangeOn = companyMaster?.isExchangeFeatureOn !== false;
  const steps = orderSteps?.steps || [];
  const stepOptions = steps.map((step) => ({ value: step.code, label: step.name }));
  const lastStep = steps[steps.length - 1] || null;
  // The agent moves an order from one step to the very next one, so the last step can't be a "from".
  const agentFromOptions = stepOptions.slice(0, -1);
  const agentToStep = draft.deliveryAgentFromStep
    ? steps[steps.findIndex((step) => step.code === draft.deliveryAgentFromStep) + 1] || null
    : null;

  const handleAgentFromChange = (value) => {
    const fromIndex = steps.findIndex((step) => step.code === value);
    const next = fromIndex >= 0 ? steps[fromIndex + 1] : null;
    set({ deliveryAgentFromStep: next ? value : '', deliveryAgentToStep: next ? next.code : '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-sm font-semibold ${theme.text.heading} mb-3`}>Cart</h3>
        <Switch
          label="Allow Out-of-Stock Products to Be Added to Cart"
          checked={draft.allowOutOfStockProductsAdding}
          onChange={(e) => set({ allowOutOfStockProductsAdding: e.target.checked })}
          color={theme.switch.color}
        />
      </div>

      {(isReturnOn || isExchangeOn) && (
      <div className="pt-4 border-t border-gray-100">
        <h3 className={`text-sm font-semibold ${theme.text.heading} mb-3`}>Return / Exchange</h3>
        <p className={`text-xs ${theme.text.muted} mb-3`}>
          Only meaningful when the Return/Exchange features themselves are enabled for this account. When off, a
          customer can only request a return/exchange for the whole order at once.
        </p>
        <div className="space-y-3">
          {isReturnOn && (
          <Switch
            label="Allow Return of a Few Items Only"
            checked={draft.fewItemsReturnOnly}
            onChange={(e) => set({ fewItemsReturnOnly: e.target.checked })}
            color={theme.switch.color}
          />
          )}
          {isExchangeOn && (
          <Switch
            label="Allow Exchange of a Few Items Only"
            checked={draft.fewItemsExchangeOnly}
            onChange={(e) => set({ fewItemsExchangeOnly: e.target.checked })}
            color={theme.switch.color}
          />
          )}
        </div>
      </div>
      )}

      <div className="pt-4 border-t border-gray-100">
        <h3 className={`text-sm font-semibold ${theme.text.heading} mb-3`}>Order</h3>
        <div className="space-y-3">
          {steps.length === 0 && (
            <p className={`text-xs ${theme.text.muted}`}>
              No order steps are assigned to your store yet, so the step settings below are not available. Please
              contact support.
            </p>
          )}
          <Switch
            label="Allow Order Cancellation"
            checked={draft.isOrderCancellationAllowed}
            onChange={(e) => set({ isOrderCancellationAllowed: e.target.checked })}
            color={theme.switch.color}
          />
          {draft.isOrderCancellationAllowed && steps.length > 0 && (
            <Dropdown
              label="Cancellation Not Allowed After Step"
              placeholder="No cutoff - cancellable until the last step"
              options={stepOptions}
              value={draft.orderCancellationNotAllowedAfterStep}
              onChange={(val) => set({ orderCancellationNotAllowedAfterStep: val || '' })}
              helperText={staleStepText(draft.orderCancellationNotAllowedAfterStep, steps)}
              clearable
            />
          )}
          {steps.length > 0 && (
            <Dropdown
              label="Mark Payment as Done at Step"
              placeholder={lastStep ? `Last step ("${lastStep.name}")` : 'Last step'}
              options={stepOptions}
              value={draft.markPaymentCompletedAtStep}
              onChange={(val) => set({ markPaymentCompletedAtStep: val || '' })}
              helperText={
                staleStepText(draft.markPaymentCompletedAtStep, steps) ||
                "When an order reaches this step, its payment is marked as done. Leave it empty to use your last step."
              }
              clearable
            />
          )}
          <Switch
            label="Auto-generate Order Number"
            checked={draft.isOrderNumberAutoGenerated}
            onChange={(e) => set({ isOrderNumberAutoGenerated: e.target.checked })}
            color={theme.switch.color}
          />
        </div>
      </div>

      {orderSteps?.isDeliveryAgentAccessOn && steps.length > 1 && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className={`text-sm font-semibold ${theme.text.heading} mb-3`}>Delivery Agent</h3>
          <p className={`text-xs ${theme.text.muted} mb-3`}>
            The one step change a delivery agent can make on orders assigned to them. Until it is set, delivery agents
            can't be assigned to orders. For orders moved to "Payment at Delivery", the payment is marked as done when
            this step change happens.
          </p>
          <div className="space-y-2">
            <Dropdown
              label="Delivery Agent Moves Orders From Step"
              placeholder="Not set - delivery agents can't be assigned"
              options={agentFromOptions}
              value={draft.deliveryAgentFromStep}
              onChange={handleAgentFromChange}
              helperText={staleStepText(draft.deliveryAgentFromStep, steps)}
              clearable
            />
            {agentToStep && (
              <p className="text-sm text-gray-700">
                ...to step: <span className="font-medium">{agentToStep.name}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartOrderSection;

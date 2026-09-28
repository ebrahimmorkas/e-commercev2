import Dropdown from '../../../../components/common/DropDown';
import { buildStepDropdownOptions, applyStepPick } from '../utils/stepAssignment';

/**
 * Multi-select of the order steps an Order template is sent for (only shown
 * while step-wise order templates are on). "All steps" / "Remaining steps"
 * are exclusive picks - see applyStepPick.
 *
 * @param {string[]} props.value - selected picks (step codes or a special pick)
 * @param {(picks: string[]) => void} props.onChange
 * @param {{code: string, name: string}[]} props.stepOptions
 * @param {boolean} props.hasWorkflow - false = no order workflow is assigned to the store yet
 * @param {string} props.error
 */
const OrderStepsField = ({ value, onChange, stepOptions, hasWorkflow, error = '' }) => (
  <Dropdown
    label="Order Steps"
    name="orderSteps"
    options={buildStepDropdownOptions(stepOptions)}
    value={value}
    onChange={(next, option) => onChange(applyStepPick(next || [], option?.value))}
    placeholder="Select the order steps"
    multiple
    searchable
    required
    error={error}
    helperText={
      hasWorkflow
        ? 'This template is sent when an order reaches any of these steps. Steps without a template send no email.'
        : 'No order workflow is assigned to your store yet, so only Rejected, Cancelled, Refunded and Payment at Delivery are available. Please contact support to get your order steps assigned.'
    }
  />
);

export default OrderStepsField;

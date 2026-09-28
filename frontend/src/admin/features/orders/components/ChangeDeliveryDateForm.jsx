import { useState } from 'react';
import Button from '../../../../components/common/Buttons';
import DatePicker from '../../../../components/common/DatePicker';
import { orderDeliveryDateValue, toDeliveryDateValue, todayStart } from '../utils/deliveryDate';
import theme from '../theme/theme';

/**
 * Changes only the delivery date of an order that already has an agent
 * (PATCH /orders/admin/:id/delivery-date). The customer is emailed about it.
 *
 * @param {Object} order
 * @param {Function} onSubmit - (deliveryDate 'YYYY-MM-DD') => Promise<boolean>
 * @param {Function} onCancel
 * @param {boolean} submitting
 */
const ChangeDeliveryDateForm = ({ order, onSubmit, onCancel, submitting }) => {
  const currentValue = orderDeliveryDateValue(order);
  const [deliveryDate, setDeliveryDate] = useState(currentValue);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deliveryDate || deliveryDate === currentValue) return;
    await onSubmit(deliveryDate);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <DatePicker
        label="Delivery date"
        name="deliveryDate"
        value={deliveryDate}
        onChange={(date) => setDeliveryDate(toDeliveryDateValue(date))}
        minDate={todayStart()}
        required
        disabled={submitting}
        helperText={deliveryDate === currentValue ? 'Pick a different date to change it.' : 'The customer will be emailed about the new date.'}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant={theme.button.primary} loading={submitting} disabled={!deliveryDate || deliveryDate === currentValue}>
          Change date
        </Button>
      </div>
    </form>
  );
};

export default ChangeDeliveryDateForm;

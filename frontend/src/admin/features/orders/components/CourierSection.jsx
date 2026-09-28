import { useEffect, useMemo, useState } from 'react';
import Checkbox from '../../../../components/common/Checkbox';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import { getActiveCouriers } from '../../../masters/courier/api/courierApi';
import theme from '../theme/theme';

/**
 * The order's courier and tracking number, shown before the Items section.
 *
 * With the courier feature on: an "Assign courier" checkbox, and while it's
 * ticked a dropdown of the store's active couriers. Save sets, changes or
 * (checkbox unticked) removes the courier - the customer is emailed each
 * time. An order has either a courier or a delivery agent, never both, so the
 * checkbox is disabled while an agent is on the order.
 *
 * With the feature off: only what's already on the order, read-only.
 *
 * @param {Object} order - needs courierId, courierName, trackingNumber,
 *   assignedDeliveryAgentId and isCourierFeatureOn (admin order detail)
 * @param {Function} onSave - (courierId | null) => Promise<boolean>
 * @param {boolean} saving
 */
const CourierSection = ({ order, onSave, saving }) => {
  const isFeatureOn = !!order.isCourierFeatureOn;
  const hasAgent = !!order.assignedDeliveryAgentId;
  const currentCourierId = order.courierId || '';

  const [isChecked, setIsChecked] = useState(!!currentCourierId);
  const [courierId, setCourierId] = useState(currentCourierId);
  const [couriers, setCouriers] = useState(null); // null = not loaded yet
  const [loadError, setLoadError] = useState('');

  // Loaded once, the first time the dropdown is needed.
  const needsCouriers = isFeatureOn && isChecked && couriers === null && !loadError;
  useEffect(() => {
    if (!needsCouriers) return undefined;
    let cancelled = false;
    getActiveCouriers()
      .then((data) => {
        if (!cancelled) setCouriers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Could not load couriers');
      });
    return () => {
      cancelled = true;
    };
  }, [needsCouriers]);
  const loadingCouriers = needsCouriers;

  // The order's current courier may since have been deactivated or deleted -
  // keep it selectable so the dropdown still shows what's on the order.
  const courierOptions = useMemo(() => {
    const options = (couriers || []).map((c) => ({ value: c._id, label: c.courierName }));
    if (currentCourierId && !options.some((o) => o.value === currentCourierId)) {
      options.unshift({ value: currentCourierId, label: `${order.courierName} (no longer active)` });
    }
    return options;
  }, [couriers, currentCourierId, order.courierName]);

  if (!isFeatureOn && !order.courierName && !order.trackingNumber) return null;

  const isAssigning = isChecked && !!courierId && courierId !== currentCourierId;
  const isRemoving = !isChecked && !!currentCourierId;
  const canSave = isAssigning || isRemoving;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave(isChecked ? courierId : null);
  };

  return (
    <div className="pt-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Courier</h3>

      {order.trackingNumber && (
        <p className="text-sm text-gray-700 mb-2">
          Tracking number: <span className="font-medium text-gray-900">{order.trackingNumber}</span>
        </p>
      )}

      {!isFeatureOn ? (
        order.courierName && (
          <p className="text-sm text-gray-700">
            Courier: <span className="font-medium text-gray-900">{order.courierName}</span>
          </p>
        )
      ) : (
        <div className="space-y-3">
          <Checkbox
            label="Assign courier"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            disabled={saving || (hasAgent && !currentCourierId)}
            description={
              hasAgent && !currentCourierId
                ? 'This order has a delivery agent. Remove the delivery agent first to ship it with a courier.'
                : undefined
            }
          />

          {isChecked &&
            (loadingCouriers ? (
              <Spinner size="sm" />
            ) : loadError ? (
              <p className="text-sm text-red-600">{loadError}</p>
            ) : courierOptions.length === 0 ? (
              <p className="text-sm text-gray-500">No active couriers. Add one on the Courier Master page.</p>
            ) : (
              <Dropdown
                label="Courier"
                name="courierId"
                options={courierOptions}
                value={courierId}
                onChange={(val) => setCourierId(val || '')}
                placeholder="Select a courier"
                searchable
                disabled={saving}
              />
            ))}

          {isRemoving && (
            <p className="text-sm text-gray-500">
              Saving will remove {order.courierName} from this order.
            </p>
          )}

          <div className="flex justify-end">
            <Button variant={theme.button.primary} onClick={handleSave} loading={saving} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourierSection;

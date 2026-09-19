import Badge from '../../components/common/Badge';
import { useRealtime } from './useRealtime';
import { CONNECTION_STATUS } from '../../utils/socketClient';

const STATUS_DISPLAY = {
  [CONNECTION_STATUS.CONNECTED]: {
    variant: 'green',
    label: 'Live',
    hint: 'Connected - this page updates in real time.',
  },
  [CONNECTION_STATUS.CONNECTING]: {
    variant: 'yellow',
    label: 'Connecting…',
    hint: 'Connecting to live updates.',
  },
  [CONNECTION_STATUS.OFFLINE]: {
    variant: 'red',
    label: 'Offline',
    hint: 'Live updates are paused. Use Refresh to reload and reconnect.',
  },
};

/**
 * Shows whether the shared realtime connection is up, so an admin can tell a
 * live page from one that has quietly stopped updating. Reusable on any admin
 * page that subscribes to realtime notifications.
 */
const LiveIndicator = () => {
  const { status } = useRealtime();
  const { variant, label, hint } = STATUS_DISPLAY[status] || STATUS_DISPLAY[CONNECTION_STATUS.CONNECTING];

  return (
    <span role="status" aria-live="polite" title={hint}>
      <Badge
        variant={variant}
        size="sm"
        dot
        className={status === CONNECTION_STATUS.CONNECTING ? 'animate-pulse' : ''}
      >
        {label}
      </Badge>
    </span>
  );
};

export default LiveIndicator;

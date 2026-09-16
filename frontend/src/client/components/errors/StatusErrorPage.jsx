import ErrorPage from './ErrorPage';
import {
  NotFoundIcon,
  ForbiddenIcon,
  UnauthorizedIcon,
  ServerErrorIcon,
  BadRequestIcon,
  NetworkErrorIcon,
} from './icons';

const goHome = () => {
  window.location.href = '/';
};

// apiClient.js throws statusCode 0 for a fetch that never reached the
// server at all (offline, DNS failure, CORS, etc.) - see its catch block.
const STATUS_CONFIG = {
  0: {
    code: 'Offline',
    icon: <NetworkErrorIcon />,
    title: "Can't reach the server",
    description: 'Check your internet connection and try again.',
  },
  400: {
    code: '400',
    icon: <BadRequestIcon />,
    title: 'Something about this request was wrong',
    description: "We couldn't process that request. Try going back and starting over.",
  },
  401: {
    code: '401',
    icon: <UnauthorizedIcon />,
    title: 'Please sign in again',
    description: 'Your session has expired or is invalid.',
  },
  403: {
    code: '403',
    icon: <ForbiddenIcon />,
    title: "You don't have access to this",
    description: "This isn't available for your account, or the store has turned it off.",
  },
  404: {
    code: '404',
    icon: <NotFoundIcon />,
    title: "We couldn't find that",
    description: "It may have been moved or doesn't exist.",
  },
  500: {
    code: '500',
    icon: <ServerErrorIcon />,
    title: 'Something went wrong on our end',
    description: "We've been notified. Please try again in a moment.",
  },
};

const configForStatus = (statusCode) => STATUS_CONFIG[statusCode] || STATUS_CONFIG[500];

/**
 * Renders the right full-page error state for an ApiError's statusCode
 * (see frontend/src/utils/apiClient.js). Used by page components in place
 * of the old generic "Couldn't load X" EmptyState block, which discarded
 * the status code and showed the same UI whether the item was missing,
 * forbidden, or the server actually failed.
 *
 * @param {Object} props
 * @param {number} [props.statusCode] - ApiError.statusCode; unrecognized/missing falls back to the 500 view.
 * @param {string} [props.message] - Backend-provided message, shown instead of the default description when present.
 * @param {() => void} [props.onRetry] - Shows a "Try Again" button when provided.
 * @param {() => void} [props.onGoHome] - Defaults to a full navigation to "/".
 */
const StatusErrorPage = ({ statusCode, message, onRetry, onGoHome }) => {
  const config = configForStatus(statusCode);
  const isNotFound = statusCode === 404;

  return (
    <ErrorPage
      icon={config.icon}
      code={config.code}
      title={config.title}
      description={message || config.description}
      primaryAction={onRetry && !isNotFound ? { label: 'Try Again', onClick: onRetry } : undefined}
      secondaryAction={{ label: 'Go Home', onClick: onGoHome || goHome }}
    />
  );
};

export default StatusErrorPage;

import ErrorPage from './ErrorPage';
import { NotFoundIcon } from './icons';

/**
 * Catch-all for a path the client's pushState router (see ClientApp.jsx's
 * parseRoute) doesn't recognize at all. Distinct from StatusErrorPage's 404
 * config, which is for a specific resource (e.g. a product id) that 404s -
 * this one is for the URL itself being unknown.
 *
 * @param {Object} props
 * @param {() => void} props.onGoHome
 */
const NotFoundPage = ({ onGoHome }) => (
  <ErrorPage
    icon={<NotFoundIcon />}
    code="404"
    title="Page not found"
    description="The page you're looking for doesn't exist or may have moved."
    primaryAction={{ label: 'Go Home', onClick: onGoHome }}
  />
);

export default NotFoundPage;

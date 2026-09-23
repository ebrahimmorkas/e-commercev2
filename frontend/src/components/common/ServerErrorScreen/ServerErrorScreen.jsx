import { useEffect, useState } from 'react';
import { onServerError } from '../../../utils/apiClient';
import ErrorPage from '../../../client/components/errors/ErrorPage';
import { ServerErrorIcon } from '../../../client/components/errors/icons';

/**
 * Full-page error shown whenever the backend reports an unexpected server
 * error - any request whose failure went through its logException(), which
 * also saved an ErrorLog document whose requestId is the reference shown here.
 * Mounted once around both apps (storefront and admin, see main.jsx); the page
 * underneath stays mounted, so "Dismiss" returns to it as it was.
 *
 * errorDetails (the real error message) only arrives from a development
 * backend; production sends just the reference.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.homePath] - Where "Go Home" goes ('/admin' for the admin panel).
 */
const ServerErrorScreen = ({ children, homePath = '/' }) => {
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    onServerError((error) => setServerError(error));
    return () => onServerError(null);
  }, []);

  return (
    <>
      {children}
      {serverError && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto bg-white" role="alertdialog" aria-modal="true" aria-labelledby="server-error-title">
          <ErrorPage
            icon={<ServerErrorIcon />}
            code="500"
            title={<span id="server-error-title">Something went wrong on our end</span>}
            description="We've recorded this error. Please try again in a moment - if it keeps happening, share the reference below with support."
            primaryAction={{ label: 'Try Again', onClick: () => window.location.reload() }}
            secondaryAction={{ label: 'Go Home', onClick: () => { window.location.href = homePath; } }}
          />
          <div className="-mt-8 pb-12 px-4 max-w-md mx-auto text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">Error reference</p>
            <p className="mt-1 font-mono text-sm text-slate-700 break-all select-all">{serverError.reference}</p>
            {serverError.details && (
              <pre className="mt-4 text-left text-xs whitespace-pre-wrap break-words rounded-lg bg-slate-100 text-slate-700 p-3">{serverError.details}</pre>
            )}
            <button
              type="button"
              onClick={() => setServerError(null)}
              className="mt-6 text-sm font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ServerErrorScreen;

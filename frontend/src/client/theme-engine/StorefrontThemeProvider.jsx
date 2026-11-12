import { useEffect, useMemo, useState } from 'react';
import { StorefrontThemeContext } from './themeContext';
import { getStorefrontConfig } from './storefrontApi';
import { DEFAULT_CONFIG } from './defaultConfig';
import { applyTokens } from './tokens';

const isPreview = () => new URLSearchParams(window.location.search).get('sf_preview') === '1';

/**
 * Loads the vendor's published storefront config once, applies its design tokens, and
 * exposes it to the storefront. Any failure (or no config) means DEFAULT_CONFIG, so
 * shoppers never see a broken page. Children render only after the request settles, so
 * a vendor on a non-default theme never flashes the classic look first.
 *
 * Preview: the admin Storefront page embeds the storefront with ?sf_preview=1 and posts
 * its unsaved draft in; only same-origin messages from the embedding parent are honoured.
 */
const StorefrontThemeProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStorefrontConfig()
      .then((data) => {
        if (!cancelled && data?.themeCode) setConfig({ ...DEFAULT_CONFIG, ...data });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPreview()) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type === 'sf-preview-config' && event.data.config?.themeCode) {
        setConfig({ ...DEFAULT_CONFIG, ...event.data.config });
      }
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'sf-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    applyTokens(config);
  }, [config]);

  const value = useMemo(() => ({ config }), [config]);
  if (!ready) return null;
  return <StorefrontThemeContext.Provider value={value}>{children}</StorefrontThemeContext.Provider>;
};

export default StorefrontThemeProvider;

import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '../../../../components/common/Card';
import Button from '../../../../components/common/Buttons';
import Spinner from '../../../../components/common/Spinner';
import { useToast } from '../../../../components/common/Toast';
import { THEMES } from '../../../../client/theme-engine/themes';
import {
  getStorefrontSettings,
  saveStorefrontDraft,
  publishStorefront,
  discardStorefrontDraft,
} from '../api/storefrontAdminApi';

const SECTION_LABELS = {
  hero: 'Hero banner',
  categories: 'Shop by category',
  certificate: 'Partner certificate',
  allProducts: 'All products',
};

const DEFAULT_PRIMARY = '#f59e0b';
const sameConfig = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const StorefrontPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [options, setOptions] = useState({ fonts: [] });
  const [saved, setSaved] = useState(null); // last draft on the server
  const [published, setPublished] = useState(null);
  const [draft, setDraft] = useState(null); // what the form currently shows
  const [busy, setBusy] = useState(''); // 'save' | 'publish' | 'discard'
  const [device, setDevice] = useState('desktop');
  const iframeRef = useRef(null);
  const previewReady = useRef(false);

  const apply = useCallback((data) => {
    setOptions(data.options || { fonts: [] });
    setSaved(data.draft);
    setDraft(data.draft);
    setPublished(data.published);
  }, []);

  // Used by "Try again" (the first load is the effect below).
  const retry = () => {
    setLoading(true);
    setLoadError('');
    getStorefrontSettings()
      .then(apply)
      .catch((err) => setLoadError(err.message || 'Could not load storefront settings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    getStorefrontSettings()
      .then((data) => !cancelled && apply(data))
      .catch((err) => !cancelled && setLoadError(err.message || 'Could not load storefront settings'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [apply]);

  // Push the current (possibly unsaved) draft into the embedded storefront.
  const postPreview = useCallback((config) => {
    const frame = iframeRef.current?.contentWindow;
    if (frame && config) frame.postMessage({ type: 'sf-preview-config', config }, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'sf-preview-ready') {
        previewReady.current = true;
        postPreview(draft);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [draft, postPreview]);

  useEffect(() => {
    if (previewReady.current) postPreview(draft);
  }, [draft, postPreview]);

  const isDirty = draft && saved && !sameConfig(draft, saved);
  const hasUnpublished = draft && published && !sameConfig(draft, published);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const moveSection = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= draft.sections.length) return;
    const sections = [...draft.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    update({ sections });
  };

  const toggleSection = (index) => {
    update({ sections: draft.sections.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s)) });
  };

  const run = async (name, task, successMessage) => {
    setBusy(name);
    try {
      await task();
      toast.success(successMessage);
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setBusy('');
    }
  };

  const payload = () => ({
    themeCode: draft.themeCode,
    primaryColor: draft.primaryColor || null,
    fontFamily: draft.fontFamily || null,
    sections: draft.sections,
  });

  const handleSave = () =>
    run('save', async () => {
      const result = await saveStorefrontDraft(payload());
      setSaved(result);
      setDraft(result);
    }, 'Draft saved');

  const handlePublish = () =>
    run('publish', async () => {
      if (isDirty) {
        const result = await saveStorefrontDraft(payload());
        setSaved(result);
      }
      const result = await publishStorefront();
      setPublished(result);
      setSaved(result);
      setDraft(result);
    }, 'Published - your storefront is live with these changes');

  const handleDiscard = () =>
    run('discard', async () => {
      const result = await discardStorefrontDraft();
      setSaved(result);
      setDraft(result);
    }, 'Changes discarded');

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError || !draft) {
    return (
      <div className="max-w-8xl mx-auto p-6">
        <Card title={<span className="font-bold">Storefront</span>}>
          <p className="text-sm text-red-600">{loadError || 'Could not load storefront settings'}</p>
          <Button className="mt-4" onClick={retry}>Try again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Storefront</span>}
        subtitle="Choose how your store looks. Preview your changes, then publish when you are happy."
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {hasUnpublished && <span className="text-xs font-medium text-amber-700">Unpublished changes</span>}
            <Button variant="secondary" onClick={handleDiscard} loading={busy === 'discard'} disabled={!!busy || !hasUnpublished}>
              Discard changes
            </Button>
            <Button variant="outline" onClick={handleSave} loading={busy === 'save'} disabled={!!busy || !isDirty}>
              Save draft
            </Button>
            <Button onClick={handlePublish} loading={busy === 'publish'} disabled={!!busy || !hasUnpublished}>
              Publish
            </Button>
          </div>
        }
      >
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <div className="space-y-8">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Theme</h3>
              <div className="space-y-2">
                {Object.entries(THEMES).map(([code, theme]) => (
                  <label
                    key={code}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      draft.themeCode === code ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="theme"
                      className="mt-1"
                      checked={draft.themeCode === code}
                      onChange={() => update({ themeCode: code })}
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{theme.label}</span>
                      <span className="block text-xs text-gray-500">{theme.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Accent colour</h3>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Accent colour"
                  value={draft.primaryColor || DEFAULT_PRIMARY}
                  onChange={(e) => update({ primaryColor: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
                <span className="text-sm text-gray-600">{draft.primaryColor || 'Default'}</span>
                {draft.primaryColor && (
                  <button type="button" onClick={() => update({ primaryColor: null })} className="cursor-pointer text-xs text-gray-500 underline">
                    Reset
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">Used for buttons, highlights and links across your store.</p>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Font</h3>
              <select
                value={draft.fontFamily || ''}
                onChange={(e) => update({ fontFamily: e.target.value || null })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Default</option>
                {options.fonts.map((font) => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold text-gray-900">Home page sections</h3>
              <p className="mb-3 text-xs text-gray-500">Turn sections on or off and change their order.</p>
              <ul className="space-y-2">
                {draft.sections.map((section, index) => (
                  <li key={section.type} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                    <input
                      type="checkbox"
                      aria-label={`Show ${SECTION_LABELS[section.type] || section.type}`}
                      checked={section.enabled}
                      onChange={() => toggleSection(index)}
                    />
                    <span className={`flex-1 text-sm ${section.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                      {SECTION_LABELS[section.type] || section.type}
                    </span>
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => moveSection(index, -1)}
                      className="cursor-pointer rounded px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === draft.sections.length - 1}
                      onClick={() => moveSection(index, 1)}
                      className="cursor-pointer rounded px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Live preview</h3>
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 text-sm">
                {['desktop', 'mobile'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevice(d)}
                    className={`cursor-pointer px-3 py-1.5 capitalize ${device === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center rounded-lg bg-gray-100 p-3">
              <iframe
                ref={iframeRef}
                title="Storefront preview"
                src="/?sf_preview=1"
                onLoad={() => {
                  previewReady.current = true;
                  postPreview(draft);
                }}
                className="h-[720px] rounded border border-gray-300 bg-white"
                style={{ width: device === 'mobile' ? 390 : '100%' }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">The preview shows unsaved edits. Shoppers only see them after you publish.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StorefrontPage;

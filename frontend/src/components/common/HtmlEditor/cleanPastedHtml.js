// Turns HTML copied from a web page / Word / Docs into the small, clean tag set
// the editor's toolbar produces, so pasted bold/italic/headings survive as real
// markup instead of being flattened to plain text.

const KEEP = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'br', 'strong', 'em', 'u', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const RENAME = { b: 'strong', i: 'em', h5: 'h4', h6: 'h4' };
const DROP = new Set(['script', 'style', 'head', 'meta', 'link', 'title', 'iframe', 'object', 'embed', 'noscript']);

const isSafeHref = (href) => /^(https?:|mailto:|tel:|\/|#)/i.test(href.trim());

// Inline styling (what Word / Docs use instead of <b>/<i>) -> wrapper tags.
const styleWrappers = (el) => {
  const style = el.style;
  if (!style) return [];
  const tags = [];
  const weight = style.fontWeight;
  if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) tags.push('strong');
  if (style.fontStyle === 'italic') tags.push('em');
  if ((style.textDecorationLine || style.textDecoration || '').includes('underline')) tags.push('u');
  return tags;
};

const serialize = (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const name = node.tagName.toLowerCase();
  if (DROP.has(name)) return '';

  let inner = Array.from(node.childNodes).map(serialize).join('');
  if (name === 'br') return '<br />';

  const tag = RENAME[name] || name;
  if (KEEP.has(tag)) {
    // A <b style="font-weight:normal"> wrapper (Google Docs) isn't really bold.
    if (tag === 'strong' && name === 'b' && node.style?.fontWeight === 'normal') return inner;
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      return isSafeHref(href) ? `<a href="${href.replace(/"/g, '&quot;')}">${inner}</a>` : inner;
    }
    return `<${tag}>${inner}</${tag}>`;
  }

  // Unknown wrapper (span, div, font...): keep only the formatting it carries.
  if (inner.trim()) {
    styleWrappers(node).forEach((t) => {
      inner = `<${t}>${inner}</${t}>`;
    });
  }
  return name === 'div' && inner.trim() ? `<p>${inner}</p>` : inner;
};

/**
 * @param {string} html - clipboard `text/html`
 * @returns {string} clean HTML, or '' if nothing usable
 */
export const cleanPastedHtml = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.body.childNodes)
    .map(serialize)
    .join('')
    .replace(/<(p|h[1-4]|li)>\s*<\/\1>/g, '')
    .replace(/(<\/(?:p|h[1-4]|ul|ol|li|tr|table)>)(?!\n)/g, '$1\n')
    .trim();
};

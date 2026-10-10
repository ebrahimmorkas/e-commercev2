/**
 * Turns what was typed in the "Insert link" dialog into the href to embed:
 * a web address (http/https), an email address (mailto:) or a phone number
 * (tel:). {{variable}} tokens may appear anywhere in it - they are filled in
 * when the email is sent.
 */

const TOKEN = /\{\{\s*[\w:-]+\s*\}\}/g;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{6,20}$/;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
// Characters that would break out of href="..." in the HTML source.
const UNSAFE_PATTERN = /["'<>`]/;

export const MAX_LINK_URL_LENGTH = 2000;

// Tokens stand in for real text at send time, so they're checked as a letter.
const withoutTokens = (value) => value.replace(TOKEN, 'x');

const isValidWebUrl = (href) => {
  const probe = withoutTokens(href);
  if (/\s/.test(probe)) return false;
  try {
    const { hostname } = new URL(probe);
    return hostname === 'localhost' || /^[^.]+(\.[^.]+)+$/.test(hostname);
  } catch {
    return false;
  }
};

/**
 * @param {string} input - what the admin typed
 * @returns {{ href: string, error: string }} href is '' when there is an error
 */
export const resolveLinkUrl = (input) => {
  const value = String(input || '').trim();
  if (!value) return { href: '', error: 'Please enter where the link should go.' };
  if (value.length > MAX_LINK_URL_LENGTH) return { href: '', error: `The link can be at most ${MAX_LINK_URL_LENGTH} characters.` };
  if (UNSAFE_PATTERN.test(value)) return { href: '', error: 'The link cannot contain quotes, < or >.' };

  const fail = (error) => ({ href: '', error });

  if (/^https?:\/\//i.test(value)) {
    return isValidWebUrl(value) ? { href: value, error: '' } : fail('Please enter a valid web address, e.g. https://google.com');
  }
  if (/^mailto:/i.test(value)) {
    const address = withoutTokens(value.slice(7).split('?')[0]);
    return EMAIL_PATTERN.test(address) || address === 'x' ? { href: value, error: '' } : fail('Please enter a valid email address after mailto:');
  }
  if (/^tel:/i.test(value)) {
    const number = withoutTokens(value.slice(4));
    return PHONE_PATTERN.test(number) || number === 'x' ? { href: value, error: '' } : fail('Please enter a valid phone number after tel:');
  }

  // A link that is entirely one variable, e.g. {{trackingUrl}}.
  if (withoutTokens(value) === 'x') return { href: value, error: '' };
  // Any other scheme (javascript:, data:, ftp: ...) is not offered.
  if (SCHEME_PATTERN.test(value) && !/^[^/]+:\d/.test(value)) {
    return fail('Only web (https://), email (mailto:) and phone (tel:) links are supported.');
  }

  const probe = withoutTokens(value);
  if (EMAIL_PATTERN.test(probe)) return { href: `mailto:${value}`, error: '' };
  if (/^\+?[\d\s().-]+$/.test(probe)) {
    const digits = probe.replace(/\D/g, '').length;
    return digits >= 6 && digits <= 15 ? { href: `tel:${value.replace(/[\s().-]/g, '')}`, error: '' } : fail('Please enter a valid phone number (6 to 15 digits).');
  }

  const href = `https://${value}`;
  return isValidWebUrl(href) ? { href, error: '' } : fail('Please enter a valid web address, email address or phone number.');
};

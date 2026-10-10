// The old policies were pasted in from other websites and editors, so their
// HTML carries those sites' fonts, colours, sizes, class names and ids. The
// new storefront styles policy text itself (PolicyContent.jsx), so only the
// structure is kept: headings, paragraphs, lists, line breaks, bold / italic
// / underline and links. Everything else is unwrapped (its text stays) and
// every attribute is dropped - except a link's address.

// Kept as they are, with no attributes.
const KEPT_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i', 'u', 'a', 'blockquote'
]);

// Removed together with everything inside them.
const DROPPED_BLOCKS = ['script', 'style', 'svg', 'iframe', 'object', 'embed', 'noscript'];

// A link may only point at a web page, an email address or a phone number.
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/)/i;

const readHref = (attributes) => {
    try {
        const match = String(attributes || '').match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        if (!match) {
            return null;
        }
        const href = (match[1] ?? match[2] ?? match[3] ?? '').trim();
        return SAFE_HREF.test(href) ? href.replace(/"/g, '&quot;') : null;
    } catch (err) {
        throw err;
    }
};

// One tag of the old HTML -> what replaces it in the cleaned HTML.
const cleanTag = (isClosing, tagName, attributes) => {
    try {
        const tag = tagName.toLowerCase();
        if (!KEPT_TAGS.has(tag)) {
            return '';
        }
        if (isClosing) {
            return tag === 'br' ? '' : `</${tag}>`;
        }
        if (tag === 'a') {
            const href = readHref(attributes);
            return href ? `<a href="${href}">` : '<a>';
        }
        return `<${tag}>`;
    } catch (err) {
        throw err;
    }
};

// Old policy HTML -> the same content with only its structure left.
// Returns '' when nothing readable remains.
const cleanPolicyHtml = (html) => {
    try {
        let cleaned = String(html || '');

        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
        for (const tag of DROPPED_BLOCKS) {
            cleaned = cleaned.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, 'gi'), '');
        }

        cleaned = cleaned.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, slash, tagName, attributes) =>
            cleanTag(slash === '/', tagName, attributes));

        // A link that lost its address is just its text.
        cleaned = cleaned.replace(/<a>([\s\S]*?)<\/a>/g, '$1');

        // A heading wrapped around whole paragraphs or lists (seen in the old
        // terms) would turn all of that text into heading text - unwrap it.
        cleaned = cleaned.replace(/<h([1-6])>((?:(?!<\/h\1>)[\s\S])*)<\/h\1>/g, (match, level, inner) =>
            (/<(?:p|ul|ol)>/.test(inner) ? inner : match));

        // A line break right at the start or end of a paragraph only adds a gap.
        cleaned = cleaned
            .replace(/<(p|li|h[1-6])>(?:\s|<br>)+/g, '<$1>')
            .replace(/(?:\s|<br>)+<\/(p|li|h[1-6])>/g, '</$1>');

        // Empty leftovers: <p></p>, <p><br></p>, <strong> </strong> ... - repeated,
        // because removing one can empty the element around it.
        const EMPTY_ELEMENT = /<(p|h[1-6]|li|ul|ol|strong|b|em|i|u|blockquote)>(?:\s|&nbsp;|<br>)*<\/\1>/g;
        let previous;
        do {
            previous = cleaned;
            cleaned = cleaned.replace(EMPTY_ELEMENT, '');
        } while (cleaned !== previous);

        cleaned = cleaned
            .replace(/[ \t\r\n]+/g, ' ')
            .replace(/(?:<br>\s*){3,}/g, '<br><br>')
            .replace(/\s*(<\/?(?:p|h[1-6]|ul|ol|li|blockquote)>)\s*/g, '$1')
            .trim();

        const text = cleaned.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

        return text ? cleaned : '';
    } catch (err) {
        throw err;
    }
};

module.exports = {
    cleanPolicyHtml
};

// Minimal, dependency-free slug generator. Lowercases, strips anything
// that isn't a letter/number, collapses whitespace/separators into single
// hyphens, and trims leading/trailing hyphens.
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

module.exports = slugify;
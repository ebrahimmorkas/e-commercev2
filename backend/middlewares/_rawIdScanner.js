// TEMPORARY verification tool, not part of the app's real middleware stack -
// wraps res.json to recursively scan every outgoing response body for any
// string that looks like a raw, undecoded 24-char hex Mongo ObjectId, and
// logs a flat list of exactly where they were found (method, path, JSON
// path, value). Meant to be required once from server.js during the
// ID-encoding rollout verification pass, then removed.
const HEX24 = /^[0-9a-f]{24}$/i;

const scan = (value, path, hits) => {
    if (value == null) return;
    if (typeof value === 'string') {
        if (HEX24.test(value)) hits.push({ path, value });
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((v, i) => scan(v, `${path}[${i}]`, hits));
        return;
    }
    if (typeof value === 'object') {
        // Don't descend into Date/ObjectId/Buffer-like objects with custom
        // toJSON - toJSON's own string output is what actually gets sent,
        // and is checked via the outer JSON.stringify round-trip instead.
        for (const key of Object.keys(value)) {
            scan(value[key], path ? `${path}.${key}` : key, hits);
        }
    }
};

const rawIdScanner = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        try {
            // Round-trip through JSON exactly as Express would serialize it,
            // so ObjectId/Date instances become their real wire strings.
            const serialized = JSON.parse(JSON.stringify(body));
            const hits = [];
            scan(serialized, '', hits);
            if (hits.length > 0) {
                console.warn(`[RAW-ID-SCAN] ${req.method} ${req.originalUrl} - ${hits.length} raw id(s) found:`);
                hits.forEach((h) => console.warn(`  ${h.path || '(root)'} = ${h.value}`));
            }
        } catch (err) {
            console.warn('[RAW-ID-SCAN] scan failed:', err.message);
        }
        return originalJson(body);
    };
    next();
};

module.exports = rawIdScanner;

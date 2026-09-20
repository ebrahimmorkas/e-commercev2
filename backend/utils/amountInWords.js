// Spells a money amount out in English for the "Amount Chargeable (in words)" lines on an
// invoice, e.g. 6914 AED -> "Six Thousand Nine Hundred Fourteen UAE Dirham Only" and
// 329.31 AED -> "Three Hundred Twenty Nine UAE Dirham and Thirty One fils Only".

const ONES = [
    'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

// Currency wording by ISO-style code. Anything not listed falls back to the bare code, with
// the fractional part shown as a fraction such as "and 50/100" (see amountInWords).
const CURRENCY_NAMES = {
    AED: { major: 'UAE Dirham', minor: 'fils', decimals: 2 },
    SAR: { major: 'Saudi Riyal', minor: 'halalas', decimals: 2 },
    QAR: { major: 'Qatari Riyal', minor: 'dirhams', decimals: 2 },
    OMR: { major: 'Omani Rial', minor: 'baisa', decimals: 3 },
    KWD: { major: 'Kuwaiti Dinar', minor: 'fils', decimals: 3 },
    BHD: { major: 'Bahraini Dinar', minor: 'fils', decimals: 3 },
    INR: { major: 'Indian Rupees', minor: 'paise', decimals: 2, indianGrouping: true },
    USD: { major: 'US Dollars', minor: 'cents', decimals: 2 },
    EUR: { major: 'Euros', minor: 'cents', decimals: 2 },
    GBP: { major: 'Pounds Sterling', minor: 'pence', decimals: 2 }
};

const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);

const belowThousand = (n) => {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const parts = [];
    if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
    if (rest) parts.push(belowHundred(rest));
    return parts.join(' ');
};

// International grouping: thousand / million / billion.
const spellInternational = (n) => {
    if (n === 0) return ONES[0];
    const groups = [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
    const parts = [];
    let remaining = n;
    for (const [size, label] of groups) {
        if (remaining >= size) {
            parts.push(`${belowThousand(Math.floor(remaining / size))} ${label}`);
            remaining %= size;
        }
    }
    if (remaining) parts.push(belowThousand(remaining));
    return parts.join(' ');
};

// Indian grouping: thousand / lakh / crore.
const spellIndian = (n) => {
    if (n === 0) return ONES[0];
    const groups = [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']];
    const parts = [];
    let remaining = n;
    for (const [size, label] of groups) {
        if (remaining >= size) {
            parts.push(`${spellIndian(Math.floor(remaining / size))} ${label}`);
            remaining %= size;
        }
    }
    if (remaining) parts.push(belowThousand(remaining));
    return parts.join(' ');
};

/**
 * @param {number} amount - non-negative
 * @param {string} currencyCode - e.g. 'AED'
 * @param {number} [decimalPlaces] - the order's currency decimals; defaults to the currency's own
 * @returns {string}
 */
const amountInWords = (amount, currencyCode, decimalPlaces) => {
    const names = CURRENCY_NAMES[String(currencyCode || '').toUpperCase()] || null;
    const decimals = decimalPlaces ?? names?.decimals ?? 2;
    const scale = 10 ** decimals;
    const totalMinor = Math.round(Math.max(0, Number(amount) || 0) * scale);
    const majorPart = Math.floor(totalMinor / scale);
    const minorPart = totalMinor % scale;

    const spell = names?.indianGrouping ? spellIndian : spellInternational;
    const majorName = names?.major || String(currencyCode || '').toUpperCase();

    let words = `${spell(majorPart)} ${majorName}`.trim();
    if (minorPart > 0) {
        // Unknown currency: no name for the fractional unit, so show it as a fraction
        // ("and 50/100") rather than dropping money from the words.
        words += names?.minor
            ? ` and ${spell(minorPart)} ${names.minor}`
            : ` and ${String(minorPart).padStart(decimals, '0')}/${scale}`;
    }
    return `${words} Only`;
};

module.exports = { amountInWords };

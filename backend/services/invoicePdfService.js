const path = require('path');
const pdfmake = require('pdfmake');
const logger = require('../utils/logger');

// Renders an Invoice document (models/Invoice.js) to a PDF Buffer. It reads ONLY the invoice,
// never the live order/settings, so the output for a given invoice never changes.
//
// Fonts: pdfmake ships Roboto; Roboto has no Arabic/CJK glyphs and pdfmake does no
// right-to-left shaping, so the document is Latin-script only.

const ROBOTO_DIR = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
pdfmake.addFonts({
    Roboto: {
        normal: path.join(ROBOTO_DIR, 'Roboto-Regular.ttf'),
        bold: path.join(ROBOTO_DIR, 'Roboto-Medium.ttf'),
        italics: path.join(ROBOTO_DIR, 'Roboto-Italic.ttf'),
        bolditalics: path.join(ROBOTO_DIR, 'Roboto-MediumItalic.ttf')
    }
});
// Nothing in an invoice is fetched by pdfmake itself (the logo is downloaded and embedded by us), and the only
// local files it may read are its own bundled fonts.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((filePath) => path.resolve(filePath).startsWith(ROBOTO_DIR));

const DEFAULT_DECLARATION = 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
const COLORS = { line: '#9ca3af', headFill: '#f3f4f6', muted: '#6b7280', totalFill: '#e5e7eb' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const text = (value) => (value === null || value === undefined ? '' : String(value));

const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return `${String(date.getDate()).padStart(2, '0')}-${MONTHS[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
};

// ---- Logo -----------------------------------------------------------------------------
// The logo lives on the storage provider (Cloudinary/S3/...). It is downloaded once and kept
// in memory by URL - a replaced logo gets a new URL, so a stale entry is never reused.
// Any failure just means the invoice is printed without a logo.
const logoCache = new Map();
const LOGO_CACHE_MAX = 20;
const LOGO_TIMEOUT_MS = 4000;

const toPdfFriendlyLogoUrl = (url) =>
    // Cloudinary can convert + shrink on the fly; pdfmake only embeds PNG/JPEG.
    /res\.cloudinary\.com/.test(url) && url.includes('/upload/') ? url.replace('/upload/', '/upload/f_jpg,w_300/') : url;

const fetchLogoDataUrl = async (logoUrl) => {
    if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) return null;
    if (logoCache.has(logoUrl)) return logoCache.get(logoUrl);

    let dataUrl = null;
    try {
        const response = await fetch(toPdfFriendlyLogoUrl(logoUrl), { signal: AbortSignal.timeout(LOGO_TIMEOUT_MS) });
        const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (response.ok && (contentType === 'image/png' || contentType === 'image/jpeg')) {
            const bytes = Buffer.from(await response.arrayBuffer());
            dataUrl = `data:${contentType};base64,${bytes.toString('base64')}`;
        }
    } catch (err) {
        logger.logInfo(0, 1, 'Invoice logo could not be fetched - rendering without it', { logoUrl, reason: err.message });
    }

    if (logoCache.size >= LOGO_CACHE_MAX) logoCache.delete(logoCache.keys().next().value);
    logoCache.set(logoUrl, dataUrl);
    return dataUrl;
};

// ---- Building blocks --------------------------------------------------------------------
const boxLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => COLORS.line,
    vLineColor: () => COLORS.line,
    paddingLeft: () => 5,
    paddingRight: () => 5,
    paddingTop: () => 3,
    paddingBottom: () => 3
};

const label = (value) => ({ text: value, color: COLORS.muted, fontSize: 7.5 });

const buildHeader = (invoice, hasLogo) => {
    const { seller } = invoice;
    const contactParts = [seller.phone ? `Mobile: ${seller.phone}` : null, seller.email ? `E-Mail: ${seller.email}` : null].filter(Boolean);
    const regionLine = [seller.region, seller.country].filter(Boolean).join(', ');

    const center = [
        { text: text(seller.name), bold: true, fontSize: 13 },
        ...seller.addressLines.map((line) => ({ text: line })),
        ...(regionLine ? [{ text: regionLine }] : []),
        ...(contactParts.length ? [{ text: contactParts.join('     ') }] : []),
        ...(seller.trn ? [{ text: `TRN: ${seller.trn}`, bold: true, margin: [0, 2, 0, 0] }] : [])
    ];

    return {
        columns: [
            hasLogo ? { image: 'logo', fit: [80, 60], width: 80 } : { text: '', width: 80 },
            { stack: center, alignment: 'center', width: '*' },
            { text: '', width: 80 }
        ],
        margin: [0, 0, 0, 8]
    };
};

const buildInfoBox = (invoice, document = 'invoice') => {
    const { buyer } = invoice;
    const buyerStack = [
        label('Buyer'),
        { text: text(buyer.name), bold: true },
        ...buyer.addressLines.map((line) => ({ text: line })),
        ...(buyer.contactPerson ? [{ text: `Contact person: ${buyer.contactPerson}` }] : []),
        ...(buyer.phone ? [{ text: `Contact: ${buyer.phone}` }] : []),
        ...(buyer.email ? [{ text: `E-Mail: ${buyer.email}` }] : []),
        ...(buyer.trn ? [{ text: `TRN: ${buyer.trn}`, bold: true }] : []),
        ...(invoice.placeOfSupply ? [{ text: `Place of supply: ${invoice.placeOfSupply}`, margin: [0, 3, 0, 0] }] : [])
    ];

    const detailRow = (name, value) => [{ text: name, color: COLORS.muted }, { text: text(value), bold: true }];
    const isCreditNote = document === 'credit-note';
    const detailsTable = {
        table: {
            widths: [72, '*'],
            body: isCreditNote
                ? [
                    detailRow('Credit Note No.', invoice.creditNote.number),
                    detailRow('Dated', formatDate(invoice.creditNote.issuedAt)),
                    detailRow('Against Invoice', invoice.invoiceNumber),
                    detailRow('Invoice date', formatDate(invoice.issuedAt)),
                    detailRow('Order No.', invoice.orderNumber)
                ]
                : [
                    detailRow('Invoice No.', invoice.invoiceNumber),
                    detailRow('Dated', formatDate(invoice.issuedAt)),
                    detailRow('Order No.', invoice.orderNumber),
                    ...(invoice.orderPlacedAt ? [detailRow('Order date', formatDate(invoice.orderPlacedAt))] : [])
                ]
        },
        layout: 'noBorders'
    };

    return {
        table: { widths: ['*', 190], body: [[{ stack: buyerStack }, detailsTable]] },
        layout: boxLayout,
        margin: [0, 0, 0, 8]
    };
};

const buildItemsTable = (invoice, money) => {
    const tax = invoice.taxLabel;
    const code = invoice.currencyCode;
    const head = (title, sub, alignment = 'right') => ({
        stack: [{ text: title, bold: true }, ...(sub ? [{ text: sub, fontSize: 7, color: COLORS.muted }] : [])],
        alignment,
        fillColor: COLORS.headFill
    });

    const body = [[
        head('#', null, 'center'),
        head('Description of Goods', null, 'left'),
        head('Qty', null, 'center'),
        head('Rate', `(${code})`),
        head('Amount', `(${code})`),
        head(`${tax} %`, null, 'center'),
        head(tax, `(${code})`),
        head(`Total incl. ${tax}`, `(${code})`)
    ]];

    invoice.lines.forEach((line, index) => {
        body.push([
            { text: String(index + 1), alignment: 'center' },
            {
                stack: [
                    { text: line.description },
                    ...(line.sku ? [{ text: `SKU: ${line.sku}`, fontSize: 7, color: COLORS.muted }] : [])
                ]
            },
            { text: String(line.quantity), alignment: 'center' },
            { text: money(line.unitPrice), alignment: 'right' },
            { text: money(line.amount), alignment: 'right' },
            { text: `${line.taxRate}%`, alignment: 'center' },
            { text: money(line.taxAmount), alignment: 'right' },
            { text: money(line.total), alignment: 'right' }
        ]);
    });

    const sum = (field) => invoice.lines.reduce((total, line) => total + line[field], 0);
    const totalCell = (value, alignment = 'right') => ({ text: value, bold: true, alignment, fillColor: COLORS.totalFill });
    body.push([
        totalCell('', 'center'),
        totalCell('Total', 'left'),
        totalCell(String(invoice.totals.totalQuantity), 'center'),
        totalCell(''),
        totalCell(money(sum('amount'))),
        totalCell('', 'center'),
        totalCell(money(sum('taxAmount'))),
        totalCell(money(sum('total')))
    ]);

    return {
        table: { headerRows: 1, dontBreakRows: true, widths: [16, '*', 30, 50, 58, 32, 48, 62], body },
        layout: boxLayout,
        fontSize: 8
    };
};

const buildTotalsBox = (invoice, money) => {
    const { totals } = invoice;
    const row = (name, value, opts = {}) => [
        { text: name, bold: !!opts.bold, fontSize: opts.big ? 10 : 8.5, fillColor: opts.fill },
        { text: value, alignment: 'right', bold: !!opts.bold, fontSize: opts.big ? 10 : 8.5, fillColor: opts.fill }
    ];
    const signed = (value) => `${value < 0 ? '-' : ''}${money(Math.abs(value))}`;

    const body = [row(`Subtotal (excl. ${invoice.taxLabel})`, money(totals.subtotal))];
    if (totals.discount > 0) body.push(row('Discount', `-${money(totals.discount)}`));
    if (totals.freeCash > 0) body.push(row('Free Cash applied', `-${money(totals.freeCash)}`));
    if (totals.shipping > 0) body.push(row('Shipping', money(totals.shipping)));
    if (totals.additionalCharges > 0) body.push(row('Additional charges', money(totals.additionalCharges)));
    body.push(row(`${invoice.taxLabel} total`, money(totals.taxTotal)));
    if (totals.adjustment !== 0) body.push(row('Rounding / adjustment', signed(totals.adjustment)));
    if (totals.roundOff) body.push(row('Round off', signed(totals.roundOff)));
    body.push(row(`Grand Total (${invoice.currencyCode})`, money(totals.grandTotal), { bold: true, big: true, fill: COLORS.totalFill }));

    return {
        columns: [{ text: '', width: '*' }, { table: { widths: [130, 92], body }, layout: boxLayout, width: 'auto' }],
        margin: [0, 8, 0, 8]
    };
};

const buildWordsBox = (invoice, document = 'invoice') => ({
    table: {
        widths: ['*', 'auto'],
        body: [[
            {
                text: [
                    { text: document === 'credit-note' ? 'Amount Credited (in words): ' : 'Amount Chargeable (in words): ', color: COLORS.muted },
                    { text: text(invoice.amountInWords), bold: true }
                ]
            },
            { text: 'E. & O.E', alignment: 'right', color: COLORS.muted }
        ]]
    },
    layout: boxLayout,
    margin: [0, 0, 0, 8]
});

const buildTaxSummary = (invoice, money) => {
    const tax = invoice.taxLabel;
    const head = (title, alignment = 'right') => ({ text: title, bold: true, alignment, fillColor: COLORS.headFill });
    const body = [[head(`${tax} %`, 'center'), head(`Taxable Value (${invoice.currencyCode})`), head(`${tax} Amount (${invoice.currencyCode})`)]];
    invoice.taxSummary.forEach((row) => {
        body.push([{ text: `${row.rate}%`, alignment: 'center' }, { text: money(row.taxableValue), alignment: 'right' }, { text: money(row.taxAmount), alignment: 'right' }]);
    });
    const sum = (field) => invoice.taxSummary.reduce((total, row) => total + row[field], 0);
    const totalCell = (value, alignment = 'right') => ({ text: value, bold: true, alignment, fillColor: COLORS.totalFill });
    body.push([totalCell('Total', 'center'), totalCell(money(sum('taxableValue'))), totalCell(money(sum('taxAmount')))]);

    return {
        stack: [
            { table: { widths: [40, '*', '*'], body }, layout: boxLayout },
            {
                text: [{ text: `${tax} Amount (in words): `, color: COLORS.muted }, { text: text(invoice.taxAmountInWords), bold: true }],
                margin: [0, 4, 0, 0]
            }
        ]
    };
};

const buildBankBox = (bank) => {
    const rows = [
        ['A/c Holder\'s Name', bank.accountHolderName],
        ['Bank Name', bank.bankName],
        ['A/c No. / IBAN', bank.accountNumber],
        ['Branch', bank.branch],
        ['SWIFT Code', bank.swiftCode]
    ].filter(([, value]) => value);

    return {
        table: {
            widths: ['*'],
            body: [[{
                stack: [
                    { text: 'Company\'s Bank Details', bold: true, margin: [0, 0, 0, 2] },
                    ...rows.map(([name, value]) => ({ text: [{ text: `${name}: `, color: COLORS.muted }, { text: text(value) }] }))
                ]
            }]]
        },
        layout: boxLayout
    };
};

const buildSignatureBlock = (invoice) => ({
    unbreakable: true,
    stack: [
        { text: 'Declaration', bold: true, margin: [0, 10, 0, 2] },
        { text: invoice.declaration || DEFAULT_DECLARATION, fontSize: 8 },
        {
            table: {
                widths: ['*', '*'],
                body: [[
                    { stack: [{ text: '', margin: [0, 34, 0, 0] }, { text: 'Customer\'s Seal and Signature', color: COLORS.muted }] },
                    {
                        alignment: 'right',
                        stack: [{ text: `for ${text(invoice.seller.name)}`, bold: true }, { text: '', margin: [0, 26, 0, 0] }, { text: 'Authorised Signatory', color: COLORS.muted }]
                    }
                ]]
            },
            layout: boxLayout,
            margin: [0, 8, 0, 0]
        }
    ]
});

// One full copy of the document (an invoice or a credit note), as pdfmake content. Called once per
// printed copy so each copy gets its own fresh objects.
const buildDocumentContent = (invoice, money, hasLogo, { document, copyLabel, isFirstCopy }) => {
    const isCreditNote = document === 'credit-note';
    const title = isCreditNote
        ? (invoice.isTaxInvoice ? 'TAX CREDIT NOTE' : 'CREDIT NOTE')
        : (invoice.isTaxInvoice ? 'TAX INVOICE' : 'INVOICE');

    const lower = invoice.bank
        ? { columns: [{ width: '*', stack: [buildTaxSummary(invoice, money)] }, { width: 12, text: '' }, { width: 235, stack: [buildBankBox(invoice.bank)] }] }
        : buildTaxSummary(invoice, money);

    const notice = [];
    if (isCreditNote) {
        notice.push({ text: `Reason for credit: ${text(invoice.voidReason || 'Order cancelled')}`, alignment: 'center', color: COLORS.muted, margin: [0, 0, 0, 6] });
    } else if (invoice.status === 'VOID' && invoice.creditNote) {
        notice.push({
            text: `This invoice was cancelled on ${formatDate(invoice.voidedAt)}. See credit note ${invoice.creditNote.number}.`,
            alignment: 'center', bold: true, color: '#b91c1c', margin: [0, 0, 0, 6]
        });
    }

    return [
        // Each printed copy after the first starts on a new page.
        { text: copyLabel || '', alignment: 'right', color: COLORS.muted, fontSize: 8, margin: [0, 0, 0, 2], ...(isFirstCopy ? {} : { pageBreak: 'before' }) },
        { text: title, alignment: 'center', bold: true, fontSize: 15, margin: [0, 0, 0, 6] },
        ...notice,
        buildHeader(invoice, hasLogo),
        buildInfoBox(invoice, document),
        buildItemsTable(invoice, money),
        buildTotalsBox(invoice, money),
        buildWordsBox(invoice, document),
        lower,
        buildSignatureBlock(invoice)
    ];
};

/**
 * @param {Object} invoice - an Invoice document (or lean object)
 * @param {Object} [options]
 * @param {'invoice'|'credit-note'} [options.document] - a credit note needs invoice.creditNote
 * @param {1|2} [options.copies] - 2 prints an "Original" and a "Duplicate" copy in the same file
 * @returns {Promise<Buffer>}
 */
const renderInvoicePdf = async (invoice, { document = 'invoice', copies = 1 } = {}) => {
    try {
        const decimals = invoice.currencyDecimalPlaces ?? 2;
        const locale = invoice.currencyCode === 'INR' ? 'en-IN' : 'en-US';
        const money = (value) => Number(value || 0).toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        const isCreditNote = document === 'credit-note';
        if (isCreditNote && !invoice.creditNote) throw new Error('This invoice has no credit note.');

        const logoDataUrl = await fetchLogoDataUrl(invoice.seller.logoUrl);

        const copyLabels = copies === 2 ? ['(Original)', '(Duplicate)'] : [''];
        const content = copyLabels.flatMap((copyLabel, index) =>
            buildDocumentContent(invoice, money, !!logoDataUrl, { document, copyLabel, isFirstCopy: index === 0 })
        );

        const docTitle = isCreditNote
            ? `${invoice.isTaxInvoice ? 'Tax Credit Note' : 'Credit Note'} ${invoice.creditNote.number}`
            : `${invoice.isTaxInvoice ? 'Tax Invoice' : 'Invoice'} ${invoice.invoiceNumber}`;

        const docDefinition = {
            pageSize: 'A4',
            pageMargins: [28, 28, 28, 44],
            defaultStyle: { font: 'Roboto', fontSize: 8.5, lineHeight: 1.15 },
            info: { title: docTitle, author: text(invoice.seller.name) },
            ...(logoDataUrl ? { images: { logo: logoDataUrl } } : {}),
            // A cancelled invoice is stamped across every page.
            ...(!isCreditNote && invoice.status === 'VOID' ? { watermark: { text: 'CANCELLED', color: '#dc2626', opacity: 0.12, bold: true, fontSize: 90 } } : {}),
            content,
            footer: (currentPage, pageCount) => ({
                margin: [28, 12, 28, 0],
                columns: [
                    { text: isCreditNote ? 'This is a Computer Generated Credit Note' : 'This is a Computer Generated Invoice', color: COLORS.muted, fontSize: 7.5 },
                    { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', color: COLORS.muted, fontSize: 7.5 }
                ]
            })
        };

        return await pdfmake.createPdf(docDefinition).getBuffer();
    } catch (err) {
        throw err;
    }
};

module.exports = { renderInvoicePdf };

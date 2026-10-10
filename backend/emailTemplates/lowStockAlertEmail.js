/*
|--------------------------------------------------------------------------
| LOW STOCK ALERT EMAIL
|--------------------------------------------------------------------------
| The built-in email a vendor's admin gets when product stock runs low.
| Edit the text / HTML below to change the email - nothing else needs to be
| touched (services/lowStockAlertService.js fills in the {{placeholders}}).
| Restart the backend after editing.
|
| Placeholders available in SUBJECT, HTML and TEXT:
|   {{companyName}}  - the store's name (Company Settings > General)
|   {{adminName}}    - the admin's name (Company Settings > General)
|   {{threshold}}    - the vendor's low stock quantity (Company Settings > Product)
|   {{itemCount}}    - how many product sizes are listed in this email
|   {{rows}}         - one ROW_HTML (in HTML) / ROW_TEXT (in TEXT) per low product size
|
| Placeholders available in ROW_HTML and ROW_TEXT (one product size):
|   {{productName}}  {{variantName}}  {{sizeName}}  {{sku}}
|   {{currentStock}} - what is left right now
|   {{stockStatus}}  - "Low stock" or "Out of stock"
|
| A placeholder that is misspelled is left in the email as-is, so a typo is
| easy to spot.
*/

const SUBJECT = 'Low stock alert - {{itemCount}} item(s) need restocking';

const HTML = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">
  <p>Hello {{adminName}},</p>
  <p>
    The stock of the following item(s) in <strong>{{companyName}}</strong> has reached your
    low stock quantity of <strong>{{threshold}}</strong> or less.
  </p>
  <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:720px;border:1px solid #e5e7eb">
    <thead>
      <tr style="background:#f3f4f6;text-align:left">
        <th style="border:1px solid #e5e7eb">Product</th>
        <th style="border:1px solid #e5e7eb">Variant</th>
        <th style="border:1px solid #e5e7eb">Size</th>
        <th style="border:1px solid #e5e7eb">SKU</th>
        <th style="border:1px solid #e5e7eb;text-align:right">Stock left</th>
        <th style="border:1px solid #e5e7eb">Status</th>
      </tr>
    </thead>
    <tbody>
      {{rows}}
    </tbody>
  </table>
  <p>Please restock these items from the Inventory section of your admin panel.</p>
  <p style="color:#6b7280;font-size:12px">
    You are receiving this email because low stock alerts are switched on in Company Settings &gt; Product.
  </p>
</div>
`;

const ROW_HTML = `
<tr>
  <td style="border:1px solid #e5e7eb">{{productName}}</td>
  <td style="border:1px solid #e5e7eb">{{variantName}}</td>
  <td style="border:1px solid #e5e7eb">{{sizeName}}</td>
  <td style="border:1px solid #e5e7eb">{{sku}}</td>
  <td style="border:1px solid #e5e7eb;text-align:right"><strong>{{currentStock}}</strong></td>
  <td style="border:1px solid #e5e7eb">{{stockStatus}}</td>
</tr>
`;

// Plain-text version of the same email (shown by email apps that don't display HTML).
const TEXT = `Hello {{adminName}},

The stock of the following item(s) in {{companyName}} has reached your low stock quantity of {{threshold}} or less.

{{rows}}

Please restock these items from the Inventory section of your admin panel.

You are receiving this email because low stock alerts are switched on in Company Settings > Product.`;

const ROW_TEXT = '- {{productName}} / {{variantName}} / {{sizeName}} (SKU {{sku}}): {{currentStock}} left - {{stockStatus}}';

module.exports = {
    SUBJECT,
    HTML,
    ROW_HTML,
    TEXT,
    ROW_TEXT
};

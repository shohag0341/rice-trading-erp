// Shared printable receipt — opens a new browser tab with a print-friendly
// receipt/slip for a Purchase or Sale transaction and triggers print.
// Used by both js/purchases.js and js/sales.js (via printReceipt()).

const fmt = (num) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 2 }).format(num || 0);

/**
 * @param {Object} options
 * @param {string} options.businessName
 * @param {string} [options.businessAddress]
 * @param {string} [options.businessPhone]
 * @param {string} options.title            'Purchase Receipt' or 'Sale Receipt'
 * @param {string} options.invoiceNo
 * @param {string} options.date             already-formatted date string
 * @param {string} options.partyLabel       'Farmer' or 'Buyer'
 * @param {string} options.partyName
 * @param {string} [options.partyPhone]
 * @param {string} options.warehouseName
 * @param {string} options.varietyName
 * @param {number} options.weightKg
 * @param {number} options.maund
 * @param {string} options.priceLabel       'Price/Maund' or 'Selling Price/Maund'
 * @param {number} options.pricePerMaund
 * @param {number} options.grossAmount
 * @param {Array<{label:string, amount:number}>} [options.costRows]
 * @param {string} options.netLabel         'Net Cost' or 'Net Amount'
 * @param {number} options.netAmount
 * @param {string} options.paidLabel        'Amount Paid' or 'Amount Received'
 * @param {number} options.amountPaid
 * @param {number} options.due
 * @param {string} [options.remarks]
 */
export function printReceipt(options) {
    const {
        businessName = 'Rice Trading ERP Pro',
        businessAddress = '',
        businessPhone = '',
        title,
        invoiceNo,
        date,
        partyLabel,
        partyName,
        partyPhone = '',
        warehouseName,
        varietyName,
        weightKg,
        maund,
        priceLabel,
        pricePerMaund,
        grossAmount,
        costRows = [],
        netLabel,
        netAmount,
        paidLabel,
        amountPaid,
        due,
        remarks = ''
    } = options;

    const costRowsHtml = costRows
        .filter(r => Number(r.amount) > 0)
        .map(r => `<tr><td>${r.label}</td><td class="amt">৳${fmt(r.amount)}</td></tr>`)
        .join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${title} - ${invoiceNo}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; color: #111; }
  .receipt { max-width: 420px; margin: 0 auto; }
  .biz-name { font-size: 20px; font-weight: 700; text-align: center; }
  .biz-sub { font-size: 12px; text-align: center; color: #555; margin-top: 2px; }
  .title { text-align: center; font-size: 14px; font-weight: 700; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 1px; border-top: 1px dashed #999; border-bottom: 1px dashed #999; padding: 8px 0; }
  .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
  .row .label { color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  table td { padding: 4px 0; }
  table td.amt { text-align: right; }
  .divider { border-top: 1px dashed #999; margin: 10px 0; }
  .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin-top: 6px; }
  .due-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #b91c1c; margin-top: 4px; }
  .footer { text-align: center; font-size: 11px; color: #777; margin-top: 24px; }
  .print-btn { display: block; width: 100%; margin: 20px auto 0; padding: 12px; font-size: 14px; font-weight: 700; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  @media print {
    body { padding: 0; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="biz-name">${businessName}</div>
    ${businessAddress ? `<div class="biz-sub">${businessAddress}</div>` : ''}
    ${businessPhone ? `<div class="biz-sub">${businessPhone}</div>` : ''}

    <div class="title">${title}</div>

    <div class="row"><span class="label">Invoice No</span><span>${invoiceNo}</span></div>
    <div class="row"><span class="label">Date</span><span>${date}</span></div>
    <div class="row"><span class="label">${partyLabel}</span><span>${partyName}</span></div>
    ${partyPhone ? `<div class="row"><span class="label">Phone</span><span>${partyPhone}</span></div>` : ''}
    <div class="row"><span class="label">Warehouse</span><span>${warehouseName}</span></div>
    <div class="row"><span class="label">Variety</span><span>${varietyName}</span></div>

    <div class="divider"></div>

    <table>
      <tr><td>Weight</td><td class="amt">${fmt(weightKg)} KG (${fmt(maund)} Md)</td></tr>
      <tr><td>${priceLabel}</td><td class="amt">৳${fmt(pricePerMaund)}</td></tr>
      <tr><td><strong>Gross Amount</strong></td><td class="amt"><strong>৳${fmt(grossAmount)}</strong></td></tr>
    </table>

    ${costRowsHtml ? `<div class="divider"></div><table>${costRowsHtml}</table>` : ''}

    <div class="divider"></div>
    <div class="total-row"><span>${netLabel}</span><span>৳${fmt(netAmount)}</span></div>
    <div class="row"><span class="label">${paidLabel}</span><span>৳${fmt(amountPaid)}</span></div>
    ${Number(due) > 0 ? `<div class="due-row"><span>Due</span><span>৳${fmt(due)}</span></div>` : ''}

    ${remarks ? `<div class="divider"></div><div class="row"><span class="label">Remarks</span><span>${remarks}</span></div>` : ''}

    <div class="footer">Generated by ${businessName}</div>

    <button class="print-btn" onclick="window.print()">Print</button>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow pop-ups for this site to print the receipt.');
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
}

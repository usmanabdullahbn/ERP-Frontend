import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney, formatDate, formatAltQty } from './ui';

/*
  Prints a business document (invoice, bill, order, receipt…) as its own
  clean A4 page. The page is built as standalone HTML in a hidden iframe, so
  the app's sidebar, header and screen layout can never end up in the print
  or PDF, whatever browser or PDF tool is used.

  Company details come from VITE_COMPANY_NAME / _ADDRESS / _PHONE / _NTN
  (each deployment points at one company's database). Missing ones are omitted.

  doc = {
    title, number, date, dueDate?, status?,
    party: { label, name, code?, phone?, address? },
    meta?: [[label, value]],          extra header facts (e.g. "Paid from")
    columns: [{ label, key, align?, money? }],
    rows: [{...}],
    totals?: [[label, value, { strong? }]],
    notes?
  }
*/
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const company = {
  name: import.meta.env.VITE_COMPANY_NAME || '',
  address: import.meta.env.VITE_COMPANY_ADDRESS || '',
  phone: import.meta.env.VITE_COMPANY_PHONE || '',
  ntn: import.meta.env.VITE_COMPANY_NTN || ''
};

const STYLES = `
  /* Zero page margin leaves the browser no room for its own header/footer
     (date, title, URL, page number); the document's margins are the body padding. */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; padding: 14mm 12mm; font-family: Inter, "Segoe UI", Arial, sans-serif; font-size: 11.5px; color: #0f172a; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 14px; border-bottom: 2px solid #0f172a; }
  .company-name { font-size: 18px; font-weight: 700; letter-spacing: .2px; }
  .muted { color: #64748b; }
  .company-line { margin-top: 2px; color: #475569; }
  .info { display: flex; justify-content: space-between; gap: 24px; margin: 0 0 18px; }
  .top + .info { margin-top: 16px; }
  .party .label, .facts .label { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #64748b; }
  .party .name { font-size: 14px; font-weight: 600; margin-top: 3px; }
  .facts table { border-collapse: collapse; }
  .facts td { padding: 2px 0; white-space: nowrap; font-size: 12px; font-weight: 700; color: #0f172a; }
  .facts td.label { text-transform: none; letter-spacing: 0; text-align: left; font-size: 12px; color: #0f172a; }
  .facts td.sep { padding: 2px 8px; }
  .facts td.value { text-align: left; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; text-align: left; padding: 7px 8px; font-weight: 600; }
  table.items td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  table.items tr:nth-child(even) td { background: #f8fafc; }
  table.items .r { text-align: right; white-space: nowrap; }
  table.items .num { font-variant-numeric: tabular-nums; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .bottom { display: flex; justify-content: space-between; gap: 24px; margin-top: 16px; page-break-inside: avoid; }
  .notes { flex: 1; color: #475569; white-space: pre-wrap; }
  .totals { min-width: 260px; border-collapse: collapse; }
  .totals td { padding: 4px 0; font-variant-numeric: tabular-nums; }
  .totals td:last-child { text-align: right; padding-left: 24px; }
  .totals tr.strong td { border-top: 2px solid #0f172a; font-size: 14px; font-weight: 700; padding-top: 8px; }
  .signs { display: flex; justify-content: space-between; margin-top: 64px; page-break-inside: avoid; }
  .sign { width: 200px; border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; color: #475569; }
  .footer { margin-top: 28px; text-align: center; font-size: 10px; color: #94a3b8; }
`;

function buildHtml(doc, orientation = 'portrait') {
  const companyBlock = company.name
    ? `<div class="company-name">${esc(company.name)}</div>
       ${company.address ? `<div class="company-line">${esc(company.address)}</div>` : ''}
       ${company.phone || company.ntn ? `<div class="company-line">${[company.phone && `Phone: ${esc(company.phone)}`, company.ntn && `NTN: ${esc(company.ntn)}`].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}`
    : '';

  const facts = [
    [`${doc.title} #`, doc.number],
    ['Date', formatDate(doc.date)],
    // Documents with terms (invoice, bill, orders) always show a due date line.
    ...('dueDate' in doc ? [['Due Date', doc.dueDate ? formatDate(doc.dueDate) : '—']] : []),
    ...(doc.meta || [])
  ];

  const party = doc.party || {};
  const head = doc.columns.map((c) => `<th class="${c.align === 'right' ? 'r' : ''}">${esc(c.label)}</th>`).join('');
  const body = doc.rows.map((row) => `<tr>${doc.columns.map((c) => {
    const v = row[c.key];
    const shown = c.money ? formatMoney(v) : v;
    return `<td class="${c.align === 'right' ? 'r num' : ''}">${esc(shown)}</td>`;
  }).join('')}</tr>`).join('');

  const totals = (doc.totals || []).map(([label, value, opts]) =>
    `<tr class="${opts?.strong ? 'strong' : ''}"><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join('');

  const pageCss = `@page { size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 0; }`;

  // No title banner: the document starts with the party and its number/date.
  // The company block only appears when company details are configured.
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)} ${esc(doc.number)}</title><style>${STYLES}\n${pageCss}</style></head><body>
    ${companyBlock ? `<div class="top"><div>${companyBlock}</div></div>` : ''}
    <div class="info">
      <div class="party">
        <div class="label">${esc(party.label || '')}</div>
        <div class="name">${esc(party.name || '')}</div>
        ${party.code ? `<div class="muted">${esc(party.code)}</div>` : ''}
        ${party.phone ? `<div>${esc(party.phone)}</div>` : ''}
        ${party.address ? `<div>${esc(party.address)}</div>` : ''}
      </div>
      <div class="facts"><table>${facts.map(([l, v]) => `<tr><td class="label">${esc(l)}</td><td class="sep">:</td><td class="value">${esc(v)}</td></tr>`).join('')}</table></div>
    </div>
    <table class="items"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <div class="bottom">
      <div class="notes">${doc.notes ? `<div class="label muted">Notes</div>${esc(doc.notes)}` : ''}</div>
      ${totals ? `<table class="totals">${totals}</table>` : ''}
    </div>
    <div class="signs">${(doc.signs || ['Prepared by', 'Received by']).map((s) => `<div class="sign">${esc(s)}</div>`).join('')}</div>
    <div class="footer">This is a computer-generated document.</div>
  </body></html>`;
}

const pdfText = (v) => String(v ?? '').replace(/[–—−]/g, '-');

export function documentFilename(doc) {
  const party = doc.party || {};
  const base = [doc.number, party.name || party.code].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '-');
  return `${base || 'document'}.pdf`;
}

export function buildDocumentPdf(doc, orientation = 'portrait') {
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  let y = 36;

  if (company.name) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42);
    pdf.text(pdfText(company.name), margin, y);
    y += 15;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    if (company.address) {
      pdf.text(pdfText(company.address), margin, y);
      y += 12;
    }
    const contactLine = [company.phone && `Phone: ${company.phone}`, company.ntn && `NTN: ${company.ntn}`].filter(Boolean).join('  |  ');
    if (contactLine) {
      pdf.text(pdfText(contactLine), margin, y);
      y += 12;
    }
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(1.2);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 18;
  }

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(pdfText(doc.title || 'Document'), margin, y);
  y += 18;

  // Party (left) & Facts (right)
  const party = doc.party || {};
  let leftY = y;
  if (party.label) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(pdfText(party.label.toUpperCase()), margin, leftY);
    leftY += 12;
  }
  if (party.name) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(pdfText(party.name), margin, leftY);
    leftY += 13;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  for (const extra of [party.code, party.phone, party.address].filter(Boolean)) {
    const wrapped = pdf.splitTextToSize(pdfText(extra), (pageWidth - margin * 2) * 0.48);
    pdf.text(wrapped, margin, leftY);
    leftY += wrapped.length * 11;
  }

  const facts = [
    [`${doc.title} #`, doc.number],
    ['Date', formatDate(doc.date)],
    ...('dueDate' in doc ? [['Due Date', doc.dueDate ? formatDate(doc.dueDate) : '-']] : []),
    ...(doc.meta || [])
  ];
  let rightY = y;
  pdf.setFontSize(9.5);
  for (const [label, value] of facts) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(pdfText(`${label}: ${value ?? ''}`), pageWidth - margin, rightY, { align: 'right' });
    rightY += 13;
  }

  y = Math.max(leftY, rightY) + 12;

  const head = [doc.columns.map((c) => pdfText(c.label))];
  const body = doc.rows.map((row) => doc.columns.map((c) => {
    const v = row[c.key];
    return pdfText(c.money ? formatMoney(v) : (v ?? ''));
  }));
  const columnStyles = {};
  doc.columns.forEach((c, idx) => {
    if (c.align === 'right') columnStyles[idx] = { halign: 'right' };
  });

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles
  });

  let afterTableY = (pdf.lastAutoTable?.finalY || y) + 16;
  if (afterTableY > pageHeight - 130) {
    pdf.addPage();
    afterTableY = 40;
  }

  // Notes (left)
  let notesBottom = afterTableY;
  if (doc.notes) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('NOTES', margin, notesBottom);
    notesBottom += 12;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    const noteLines = pdf.splitTextToSize(pdfText(doc.notes), (pageWidth - margin * 2) * 0.5);
    pdf.text(noteLines, margin, notesBottom);
    notesBottom += noteLines.length * 11;
  }

  // Totals (right)
  let totalsBottom = afterTableY;
  const totals = doc.totals || [];
  if (totals.length) {
    const labelX = pageWidth - margin - 180;
    for (const [label, value, opts] of totals) {
      if (opts?.strong) {
        pdf.setDrawColor(15, 23, 42);
        pdf.setLineWidth(1);
        pdf.line(labelX, totalsBottom - 8, pageWidth - margin, totalsBottom - 8);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
      }
      pdf.setTextColor(15, 23, 42);
      pdf.text(pdfText(label), labelX, totalsBottom);
      pdf.text(pdfText(value), pageWidth - margin, totalsBottom, { align: 'right' });
      totalsBottom += opts?.strong ? 16 : 14;
    }
  }

  let signY = Math.max(notesBottom, totalsBottom) + 46;
  if (signY > pageHeight - 50) {
    pdf.addPage();
    signY = 70;
  }
  const signs = doc.signs || ['Prepared by', 'Received by'];
  signs.forEach((s, idx) => {
    const x = idx === 0 ? margin : pageWidth - margin - 140;
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.7);
    pdf.line(x, signY, x + 140, signY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(pdfText(s), x + 70, signY + 12, { align: 'center' });
  });

  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('This is a computer-generated document.', margin, pageHeight - 18);
    pdf.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
  }

  return pdf;
}

let previewListener = null;
export function registerPrintPreviewListener(fn) {
  previewListener = fn;
  return () => { if (previewListener === fn) previewListener = null; };
}

export function executePrint(doc, orientation = 'portrait') {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  win.document.open();
  win.document.write(buildHtml(doc, orientation));
  win.document.close();

  // Chrome names the saved PDF after the app's own title, not the frame's, so
  // the app title becomes "INV-000004 ALIYAN (WATER PUMP)" while the print dialog is open.
  const appTitle = document.title;
  const party = doc.party || {};
  document.title = [doc.number, party.name || party.code].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '-');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.title = appTitle;
    setTimeout(() => frame.remove(), 500);
  };
  win.addEventListener('afterprint', cleanup);
  // Let the frame lay out before printing.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 60000); // fallback if afterprint never fires
  }, 250);
}

export function printDocument(doc) {
  if (previewListener) {
    previewListener(doc);
    return;
  }
  executePrint(doc);
}

/* The customer/supplier block from a populated party document. */
export const partyOf = (p) => ({ name: p?.name, code: p?.code, phone: p?.phone, address: p?.address });

export const statusLabel = (s) => (s ? s.replace(/_/g, ' ') : '');

/* Doc # and payment terms for the header facts — always printed, "—" when blank. */
export const docMeta = (d) => [
  ['Doc #', d.docRef || '—'],
  ['Payment Terms', d.paymentTerms || '—']
];

/* Line-item rows shared by invoices, bills, orders and purchase orders. */
export function documentLines(items, priceKey) {
  return items.map((it, i) => {
    const gross = (it.quantity || 0) * (it[priceKey] || 0);
    const discount = Math.round(gross * (it.discountRate || 0)) / 100;
    return {
      n: i + 1,
      sku: it.product?.sku || '',
      name: it.product?.name || '',
      qty: `${it.quantity} ${it.product?.unit || ''}`.trim(),
      alt: formatAltQty(it.quantity, it.product || {}) || '—',
      price: it[priceKey],
      disc: it.discountRate ? `${Math.round(it.discountRate * 100) / 100}%` : '—',
      discAmt: discount,
      amount: it.lineTotal,
      gross
    };
  });
}

export const LINE_COLUMNS = (priceLabel, items = []) => {
  const hasAlt = items.some((it) => Boolean(formatAltQty(it.quantity, it.product || {})));
  const altUnits = [...new Set(items.map((it) => it.product?.altUnit).filter(Boolean))];
  const altLabel = altUnits.length === 1 ? `Qty (${altUnits[0]})` : 'Qty (alt unit)';
  return [
    { label: '#', key: 'n' },
    { label: 'SKU', key: 'sku' },
    { label: 'Item', key: 'name' },
    { label: 'Qty', key: 'qty', align: 'right' },
    ...(hasAlt ? [{ label: altLabel, key: 'alt', align: 'right' }] : []),
    { label: priceLabel, key: 'price', align: 'right', money: true },
    { label: 'Disc %', key: 'disc', align: 'right' },
    { label: 'Disc Amt', key: 'discAmt', align: 'right', money: true },
    { label: 'Amount', key: 'amount', align: 'right', money: true }
  ];
};

/*
  Goods-only print of a document's lines — no prices. Used for the Delivery
  Challan (invoice / sales order) and the Goods Received Note (bill). Shows
  each line in its secondary unit too (e.g. lengths) when the product has one.
*/
export function printGoodsNote({ title, number, date, party, meta, items, notes, signs }) {
  const rows = items.map((it, i) => ({
    n: i + 1,
    sku: it.product?.sku || '',
    name: it.product?.name || '',
    warehouse: it.warehouse?.name || '',
    qty: `${it.quantity} ${it.product?.unit || ''}`.trim(),
    alt: formatAltQty(it.quantity, it.product || {}) || '—'
  }));
  const hasAlt = rows.some((r) => r.alt !== '—');
  const altUnits = [...new Set(items.map((it) => it.product?.altUnit).filter(Boolean))];
  const altLabel = altUnits.length === 1 ? `Qty (${altUnits[0]})` : 'Qty (alt unit)';

  // Quantities are summed per unit so ft and pcs are never added together.
  const byUnit = {};
  items.forEach((it) => { const u = it.product?.unit || ''; byUnit[u] = (byUnit[u] || 0) + Number(it.quantity || 0); });
  const totalQty = Object.entries(byUnit).map(([u, q]) => `${Math.round(q * 1000) / 1000} ${u}`.trim()).join(' + ');

  printDocument({
    title,
    number,
    date,
    party,
    meta,
    columns: [
      { label: '#', key: 'n' },
      { label: 'SKU', key: 'sku' },
      { label: 'Item', key: 'name' },
      { label: 'Warehouse', key: 'warehouse' },
      { label: 'Qty', key: 'qty', align: 'right' },
      ...(hasAlt ? [{ label: altLabel, key: 'alt', align: 'right' }] : [])
    ],
    rows,
    totals: [['Total items', String(rows.length)], ['Total quantity', totalQty, { strong: true }]],
    notes,
    signs
  });
}

/* Gross / Discount / Subtotal / Tax / Total rows for a document's totals box. */
export function documentTotals(doc, lines, extra = []) {
  const gross = lines.reduce((s, l) => s + l.gross, 0);
  const discount = lines.reduce((s, l) => s + l.discAmt, 0);
  return [
    ...(discount > 0 ? [['Gross', formatMoney(gross)], ['Discount', `−${formatMoney(discount)}`]] : []),
    ['Subtotal', formatMoney(doc.subTotal)],
    ...(doc.taxTotal ? [['Tax', formatMoney(doc.taxTotal)]] : []),
    ...(doc.roundOff ? [['Round off', formatMoney(doc.roundOff)]] : []),
    ['Total', formatMoney(doc.grandTotal), { strong: true }],
    ...extra
  ];
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatMoney } from './ui';

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'report';
}

function formatCell(value, col) {
  if (value === null || value === undefined || value === '') return '';
  if (col.money) return formatMoney(value);
  if (col.date) return formatDate(value);
  return String(value);
}

/*
  columns: [{ key, label, align: 'right'?, money?: bool, date?: bool }]
  rows: plain objects matching column keys — same data already shown on screen
  totals: optional array of footer cell values, same length as columns
*/
export function downloadReportPdf({ title, subtitle, columns, rows, totals }) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  let startY = 20;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 21);
    startY = 26;
  }

  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => formatCell(r[c.key], c))),
    foot: totals ? [totals.map((t) => (t === null || t === undefined ? '' : String(t)))] : undefined,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 32, 43] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.align === 'right') acc[i] = { halign: 'right' };
      return acc;
    }, {})
  });

  doc.save(`${sanitizeFilename(title)}.pdf`);
}

/*
  Produces an HTML table saved with an .xls extension, which Excel opens
  natively with formatting intact. Avoids pulling in a full xlsx-writer
  library (the maintained one on npm carries unpatched CVEs) for something
  this simple.
*/
export function downloadReportExcel({ title, subtitle, columns, rows, totals }) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const headerCells = columns
    .map((c) => `<th style="background:#0f202b;color:#fff;padding:6px 10px;border:1px solid #ccc;text-align:${c.align === 'right' ? 'right' : 'left'};">${esc(c.label)}</th>`)
    .join('');

  const bodyRows = rows
    .map((r) => `<tr>${columns.map((c) => `<td style="padding:6px 10px;border:1px solid #ccc;text-align:${c.align === 'right' ? 'right' : 'left'};">${esc(formatCell(r[c.key], c))}</td>`).join('')}</tr>`)
    .join('');

  const totalsRow = totals
    ? `<tr>${totals.map((t) => `<td style="padding:6px 10px;border:1px solid #ccc;font-weight:bold;">${esc(t ?? '')}</td>`).join('')}</tr>`
    : '';

  const html = `<html><head><meta charset="utf-8" /></head><body>` +
    `<h3>${esc(title)}</h3>` +
    (subtitle ? `<p>${esc(subtitle)}</p>` : '') +
    `<table border="1" cellspacing="0"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}${totalsRow}</tbody></table>` +
    `</body></html>`;

  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(title)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

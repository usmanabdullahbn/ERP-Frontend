import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatMoney } from './ui';

// Shown at the top of every exported report. Set VITE_COMPANY_NAME in the
// frontend .env to put the business name on printouts.
const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'Ledgerline';

const INK = [15, 32, 43];
const MUTED = [100, 116, 139];

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'report';
}

function formatCell(value, col) {
  if (value === null || value === undefined || value === '') return '';
  if (col.money) return formatMoney(value);
  if (col.date) return formatDate(value);
  return String(value);
}

// jsPDF's built-in Helvetica has no glyphs for typographic dashes.
const pdfText = (v) => String(v ?? '').replace(/[–—]/g, '-');

function generatedOn() {
  return new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/*
  A report is either one table (rows + totals) or a list of sections — one
  per account / customer / supplier — each printed starting on its own page
  under its own heading.

  columns:  [{ key, label, align: 'right'?, money?: bool, date?: bool }]
  rows:     plain objects matching column keys; `_bold: true` emphasises a
            row (e.g. Balance b/f)
  totals:   optional array of footer cell values, same length as columns
  sections: optional [{ title, subtitle?, rows, totals? }] — replaces rows/totals
*/
function normalizeSections({ rows, totals, sections }) {
  return sections && sections.length ? sections : [{ title: null, rows: rows || [], totals }];
}

export function downloadReportPdf({ title, subtitle, columns, rows, totals, sections }) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const printedAt = generatedOn();
  const parts = normalizeSections({ rows, totals, sections });

  // Report heading repeated on every page; section name included so a page
  // that continues an account still says which account it is.
  const drawPageHeader = (section, continued) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(COMPANY_NAME.toUpperCase(), marginX, 12);

    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(pdfText(title), marginX, 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    if (subtitle) doc.text(pdfText(subtitle), marginX, 24.5);
    doc.text(`Generated ${printedAt}`, pageWidth - marginX, 12, { align: 'right' });

    doc.setDrawColor(...INK);
    doc.setLineWidth(0.5);
    doc.line(marginX, 27.5, pageWidth - marginX, 27.5);

    if (!section.title) return 32;

    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, 30.5, pageWidth - marginX * 2, section.subtitle ? 12 : 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`${pdfText(section.title)}${continued ? '  (continued)' : ''}`, marginX + 3, 35.8);
    if (section.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(pdfText(section.subtitle), marginX + 3, 40.3);
    }
    return section.subtitle ? 46 : 42;
  };

  const columnStyles = columns.reduce((acc, c, i) => {
    if (c.align === 'right') acc[i] = { halign: 'right' };
    return acc;
  }, {});

  parts.forEach((section, index) => {
    if (index > 0) doc.addPage();
    const firstPage = doc.internal.getNumberOfPages();
    const startY = drawPageHeader(section, false);

    autoTable(doc, {
      startY,
      margin: { top: startY, left: marginX, right: marginX, bottom: 16 },
      head: [columns.map((c) => c.label)],
      body: section.rows.map((r) => columns.map((c) => pdfText(formatCell(r[c.key], c)))),
      foot: section.totals ? [section.totals.map((t) => pdfText(t))] : undefined,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.1, textColor: 30 },
      headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === 'head' || data.section === 'foot') {
          if (columns[data.column.index]?.align === 'right') data.cell.styles.halign = 'right';
        }
        if (data.section === 'body' && section.rows[data.row.index]?._bold) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
      didDrawPage: () => {
        if (doc.internal.getNumberOfPages() > firstPage) drawPageHeader(section, true);
      }
    });
  });

  // Footer once all pages exist, so "of N" is known.
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(`${COMPANY_NAME} - ${title}`), marginX, pageHeight - 6.5);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 6.5, { align: 'right' });
  }

  doc.save(`${sanitizeFilename(title)}.pdf`);
}

/*
  Produces an HTML table saved with an .xls extension, which Excel opens
  natively with formatting intact. Avoids pulling in a full xlsx-writer
  library (the maintained one on npm carries unpatched CVEs) for something
  this simple. Each section gets its own heading and a page break before it
  when printed from Excel.
*/
export function downloadReportExcel({ title, subtitle, columns, rows, totals, sections }) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const align = (c) => (c.align === 'right' ? 'right' : 'left');
  const span = columns.length;
  const parts = normalizeSections({ rows, totals, sections });

  const headerCells = columns
    .map((c) => `<th style="background:#0f202b;color:#fff;padding:6px 10px;border:1px solid #ccc;text-align:${align(c)};">${esc(c.label)}</th>`)
    .join('');

  const sectionHtml = (section, index) => {
    const heading = section.title
      ? `<tr><td colspan="${span}" style="background:#f1f5f9;font-weight:bold;font-size:13pt;padding:8px 10px;border:1px solid #ccc;">${esc(section.title)}</td></tr>` +
        (section.subtitle ? `<tr><td colspan="${span}" style="color:#64748b;padding:4px 10px;border:1px solid #ccc;">${esc(section.subtitle)}</td></tr>` : '')
      : '';
    const bodyRows = section.rows
      .map((r) => `<tr>${columns.map((c) => `<td style="padding:6px 10px;border:1px solid #ccc;text-align:${align(c)};${r._bold ? 'font-weight:bold;background:#f8fafc;' : ''}">${esc(formatCell(r[c.key], c))}</td>`).join('')}</tr>`)
      .join('');
    const totalsRow = section.totals
      ? `<tr>${section.totals.map((t, i) => `<td style="padding:6px 10px;border:1px solid #ccc;font-weight:bold;background:#e2e8f0;text-align:${align(columns[i] || {})};">${esc(t ?? '')}</td>`).join('')}</tr>`
      : '';
    return `<table border="1" cellspacing="0" style="border-collapse:collapse;${index > 0 ? 'page-break-before:always;' : ''}">` +
      `<thead>${heading}<tr>${headerCells}</tr></thead><tbody>${bodyRows}${totalsRow}</tbody></table>` +
      `<br />`;
  };

  const html = `<html><head><meta charset="utf-8" /></head><body>` +
    `<table><tr><td colspan="${span}" style="color:#64748b;font-weight:bold;">${esc(COMPANY_NAME.toUpperCase())}</td></tr>` +
    `<tr><td colspan="${span}" style="font-size:16pt;font-weight:bold;">${esc(title)}</td></tr>` +
    (subtitle ? `<tr><td colspan="${span}" style="color:#64748b;">${esc(subtitle)}</td></tr>` : '') +
    `<tr><td colspan="${span}" style="color:#64748b;">Generated ${esc(generatedOn())}</td></tr></table><br />` +
    parts.map(sectionHtml).join('') +
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

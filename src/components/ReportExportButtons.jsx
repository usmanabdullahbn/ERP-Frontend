import { FileText, FileSpreadsheet } from 'lucide-react';

export default function ReportExportButtons({ onPdf, onExcel, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPdf}
        disabled={disabled}
        title="Download PDF"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FileText size={15} /> PDF
      </button>
      <button
        type="button"
        onClick={onExcel}
        disabled={disabled}
        title="Download Excel"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FileSpreadsheet size={15} /> Excel
      </button>
    </div>
  );
}

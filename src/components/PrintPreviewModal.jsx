import { useEffect, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import { buildDocumentPdf, documentFilename, executePrint, registerPrintPreviewListener } from './printDocument';

export default function PrintPreviewModal() {
  const [doc, setDoc] = useState(null);
  const [orientation, setOrientation] = useState('portrait');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => registerPrintPreviewListener((nextDoc) => {
    setOrientation('portrait');
    setDoc(nextDoc);
  }), []);

  useEffect(() => {
    if (!doc) {
      setPreviewUrl('');
      return undefined;
    }
    const pdf = buildDocumentPdf(doc, orientation);
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [doc, orientation]);

  useEffect(() => {
    if (!doc) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDoc(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc]);

  if (!doc) return null;

  const handleSavePdf = () => {
    const pdf = buildDocumentPdf(doc, orientation);
    pdf.save(documentFilename(doc));
  };

  const handlePrint = () => {
    executePrint(doc, orientation);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink-900/50 backdrop-blur-[1px] flex items-center justify-center p-2 sm:p-4 lg:p-6 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <h2 className="font-display text-base sm:text-lg font-semibold text-ink-900 truncate">Print or Save as pdf</h2>
          <button
            type="button"
            onClick={() => setDoc(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-ink-900 hover:bg-slate-100 shrink-0"
            aria-label="Close print preview"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <aside className="w-full md:w-60 shrink-0 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-3.5 sm:p-4 flex flex-col sm:flex-row md:flex-col sm:items-end md:items-stretch gap-3 sm:gap-4">
            <p className="text-sm font-medium text-ink-800 sm:hidden md:block">Report Print Settings</p>
            <label className="block flex-1 md:flex-none">
              <span className="block text-xs font-medium text-slate-600 mb-1">Orientation</span>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="input bg-white"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </aside>

          <div className="flex-1 bg-neutral-800 min-h-[260px] flex items-center justify-center">
            {previewUrl ? (
              <iframe src={previewUrl} title="Print preview" className="w-full h-full border-0" />
            ) : (
              <div className="text-sm text-slate-300">Generating preview…</div>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button type="button" onClick={() => setDoc(null)} className="btn-ghost">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSavePdf} className="btn-ghost inline-flex items-center gap-1.5">
              <Download size={15} /> Save as pdf
            </button>
            <button type="button" onClick={handlePrint} className="btn-teal inline-flex items-center gap-1.5">
              <Printer size={15} /> Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

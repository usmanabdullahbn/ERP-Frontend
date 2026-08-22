import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import api from '../api/client';
import PageLayout from '../components/PageLayout';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import { formatMoney, todayLocalISODate } from '../components/ui';

let lineKeySeq = 0;
const newComponentLine = () => ({ _key: ++lineKeySeq, component: '', quantity: 1 });

export default function Assembly() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('inventory.manage');

  const [tab, setTab] = useState('production');
  const [assemblies, setAssemblies] = useState([]);
  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadError, setLoadError] = useState('');

  // Production run modal
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodProduct, setProdProduct] = useState('');
  const [prodWarehouse, setProdWarehouse] = useState('');
  const [prodQuantity, setProdQuantity] = useState(1);
  const [prodDate, setProdDate] = useState(todayLocalISODate());
  const [prodNote, setProdNote] = useState('');
  const [prodError, setProdError] = useState('');
  const [prodSubmitting, setProdSubmitting] = useState(false);

  // Production detail modal
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');

  // BOM modal
  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState(null);
  const [bomProduct, setBomProduct] = useState('');
  const [bomNotes, setBomNotes] = useState('');
  const [bomLines, setBomLines] = useState([newComponentLine()]);
  const [bomError, setBomError] = useState('');
  const [bomSubmitting, setBomSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const loadAssemblies = () => api.get('/assemblies').then((res) => setAssemblies(res.data)).catch(() => setLoadError('Could not load production runs.'));
  const loadBoms = () => api.get('/boms').then((res) => setBoms(res.data)).catch(() => setLoadError('Could not load bills of materials.'));

  useEffect(() => {
    loadAssemblies();
    loadBoms();
    api.get('/products').then((res) => setProducts(res.data)).catch(() => setLoadError('Could not load products.'));
    api.get('/warehouses').then((res) => setWarehouses(res.data)).catch(() => setLoadError('Could not load warehouses.'));
  }, []);

  const defaultWarehouseId = warehouses.find((w) => w.isDefault)?._id || warehouses[0]?._id || '';

  const bomByProduct = useMemo(() => {
    const map = {};
    boms.forEach((b) => { map[b.product?._id || b.product] = b; });
    return map;
  }, [boms]);

  const productsWithBom = useMemo(
    () => products.filter((p) => bomByProduct[p._id]),
    [products, bomByProduct]
  );

  const stockOf = (productId, warehouseId) => {
    const prod = products.find((p) => p._id === productId);
    const entry = prod?.stockByWarehouse?.find((s) => (s.warehouse?._id || s.warehouse) === warehouseId);
    return entry ? entry.quantity : 0;
  };

  const money = formatMoney;

  // ---- Production run ----

  const openProdCreate = () => {
    setProdProduct(''); setProdWarehouse(defaultWarehouseId); setProdQuantity(1);
    setProdDate(todayLocalISODate()); setProdNote(''); setProdError(''); setProdModalOpen(true);
  };

  const selectedBom = prodProduct ? bomByProduct[prodProduct] : null;
  const requirementRows = selectedBom
    ? selectedBom.components.map((c) => {
        const required = round2((c.quantity || 0) * (prodQuantity || 0));
        const available = stockOf(c.component._id || c.component, prodWarehouse);
        return { key: c.component._id || c.component, name: c.component.name, required, available, short: available < required };
      })
    : [];
  const hasShortage = requirementRows.some((r) => r.short);

  const saveProduction = async () => {
    if (prodSubmitting) return;
    setProdError('');
    if (!prodProduct) return setProdError('Select a finished product.');
    if (!prodWarehouse) return setProdError('Select a warehouse.');
    if (!prodQuantity || prodQuantity <= 0) return setProdError('Quantity must be greater than zero.');
    setProdSubmitting(true);
    try {
      await api.post('/assemblies', {
        product: prodProduct, warehouse: prodWarehouse, quantity: prodQuantity, date: prodDate, note: prodNote
      });
      setProdModalOpen(false);
      loadAssemblies();
      // Refresh products so stock levels reflect the run that just posted.
      api.get('/products').then((res) => setProducts(res.data));
    } catch (err) {
      setProdError(err.response?.data?.message || 'Could not record production.');
    } finally {
      setProdSubmitting(false);
    }
  };

  const openDetail = async (a) => {
    setDetailError('');
    const { data } = await api.get(`/assemblies/${a._id}`);
    setDetail(data);
  };

  const handleVoidClick = (id) => {
    setConfirmMessage('Void this production run? This removes the finished stock it added and restores the components it consumed.');
    setConfirmAction(() => () => performVoid(id));
    setConfirmOpen(true);
  };

  const performVoid = async (id) => {
    try {
      await api.post(`/assemblies/${id}/void`);
      const { data } = await api.get(`/assemblies/${id}`);
      setDetail(data);
      loadAssemblies();
      api.get('/products').then((res) => setProducts(res.data));
      setConfirmOpen(false);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not void this production run.');
      setConfirmOpen(false);
    }
  };

  const assemblyColumns = [
    { key: 'assemblyNumber', label: 'Run #' },
    { key: 'product', label: 'Product', render: (r) => r.product?.name },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name },
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'quantity', label: 'Qty Produced', align: 'right', mono: true },
    { key: 'unitCost', label: 'Unit Cost', align: 'right', mono: true, render: (r) => money(r.unitCost) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> }
  ];

  // ---- Bill of Materials ----

  const openBomCreate = () => {
    setEditingBom(null); setBomProduct(''); setBomNotes(''); setBomLines([newComponentLine()]); setBomError(''); setBomModalOpen(true);
  };

  const openBomEdit = (b) => {
    setEditingBom(b);
    setBomProduct(b.product?._id || b.product);
    setBomNotes(b.notes || '');
    setBomLines(b.components.map((c) => ({ _key: ++lineKeySeq, component: c.component?._id || c.component, quantity: c.quantity })));
    setBomError('');
    setBomModalOpen(true);
  };

  const updateBomLine = (i, patch) => {
    const next = [...bomLines];
    next[i] = { ...next[i], ...patch };
    setBomLines(next);
  };
  const addBomLine = () => setBomLines([...bomLines, newComponentLine()]);
  const removeBomLine = (i) => setBomLines(bomLines.filter((_, idx) => idx !== i));

  const validBomLines = bomLines.filter((l) => l.component && l.quantity > 0);

  const saveBom = async () => {
    if (bomSubmitting) return;
    setBomError('');
    if (!bomProduct) return setBomError('Select the finished product this recipe builds.');
    if (!validBomLines.length) return setBomError('Add at least one valid component.');
    if (validBomLines.some((l) => l.component === bomProduct)) return setBomError('A product cannot be a component of its own Bill of Materials.');
    setBomSubmitting(true);
    try {
      const payload = { product: bomProduct, notes: bomNotes, components: validBomLines.map(({ component, quantity }) => ({ component, quantity })) };
      if (editingBom) {
        await api.put(`/boms/${editingBom._id}`, payload);
      } else {
        await api.post('/boms', payload);
      }
      setBomModalOpen(false);
      loadBoms();
    } catch (err) {
      setBomError(err.response?.data?.message || 'Could not save Bill of Materials.');
    } finally {
      setBomSubmitting(false);
    }
  };

  const handleBomDeleteClick = (id) => {
    setConfirmMessage('Delete this Bill of Materials? Past production runs keep their own recorded cost, but you will need to recreate it before producing this item again.');
    setConfirmAction(() => () => performBomDelete(id));
    setConfirmOpen(true);
  };

  const performBomDelete = async (id) => {
    try {
      await api.delete(`/boms/${id}`);
      loadBoms();
      setConfirmOpen(false);
    } catch (err) {
      setBomError(err.response?.data?.message || 'Could not delete Bill of Materials.');
      setConfirmOpen(false);
    }
  };

  const bomColumns = [
    { key: 'product', label: 'Finished Product', render: (r) => r.product?.name },
    { key: 'components', label: 'Components', render: (r) => r.components.map((c) => `${c.quantity} × ${c.component?.name}`).join(', ') },
    { key: 'notes', label: 'Notes' },
    canManage && { key: 'actions', label: '', align: 'right', render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={(e) => { e.stopPropagation(); openBomEdit(r); }} className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-ink-900 hover:border-slate-300" title="Edit recipe">
            <Pencil size={16} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleBomDeleteClick(r._id); }} className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-slate-300" title="Delete recipe">
            <Trash2 size={16} />
          </button>
        </div>
      ) }
  ].filter(Boolean);

  return (
    <PageLayout
      title="Assembly"
      actions={canManage && (
        tab === 'production' ? (
          <button onClick={openProdCreate} className="flex items-center gap-1.5 btn-primary" disabled={!productsWithBom.length}>
            <Plus size={15} /> New Production
          </button>
        ) : (
          <button onClick={openBomCreate} className="flex items-center gap-1.5 btn-primary">
            <Plus size={15} /> New Bill of Materials
          </button>
        )
      )}
    >
      {loadError && <div className="mb-4 text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{loadError}</div>}

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {[{ id: 'production', label: 'Production Runs' }, { id: 'bom', label: 'Bill of Materials' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-ledger-teal text-ink-900' : 'border-transparent text-slate-500 hover:text-ink-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'production' ? (
        <>
          {canManage && !productsWithBom.length && (
            <div className="mb-4 text-sm bg-ledger-amberLight text-ledger-amber px-3 py-2 rounded-lg">
              No products have a Bill of Materials yet — define one in the "Bill of Materials" tab before recording production.
            </div>
          )}
          <DataTable columns={assemblyColumns} data={assemblies} onRowClick={openDetail} emptyMessage="No production runs yet." />
        </>
      ) : (
        <DataTable columns={bomColumns} data={boms} emptyMessage="No bills of materials defined yet." />
      )}

      <Modal open={prodModalOpen} onClose={() => !prodSubmitting && setProdModalOpen(false)} title="New Production" width="max-w-2xl">
        <div className="flex flex-col gap-4">
          {prodError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{prodError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Product to produce</span>
              <select value={prodProduct} onChange={(e) => setProdProduct(e.target.value)} className="input">
                <option value="">Select…</option>
                {productsWithBom.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Warehouse</span>
              <select value={prodWarehouse} onChange={(e) => setProdWarehouse(e.target.value)} className="input">
                <option value="">Select…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Quantity to produce</span>
              <input type="number" min="0" value={prodQuantity} onChange={(e) => setProdQuantity(Number(e.target.value))} className="input font-figures" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Date</span>
              <input type="date" value={prodDate} onChange={(e) => setProdDate(e.target.value)} className="input" />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Note</span>
            <input value={prodNote} onChange={(e) => setProdNote(e.target.value)} className="input" placeholder="e.g. Daily production batch" />
          </label>

          {selectedBom && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Components required</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-2">Component</th>
                    <th className="text-right">Required</th>
                    <th className="text-right">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {requirementRows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100">
                      <td className="py-2">{r.name}</td>
                      <td className="text-right font-figures">{r.required}</td>
                      <td className={`text-right font-figures ${r.short ? 'text-ledger-rose' : ''}`}>{r.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasShortage && (
                <p className="text-xs text-ledger-rose mt-2">Not enough stock for one or more components in the selected warehouse.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button disabled={prodSubmitting || hasShortage} onClick={saveProduction} className="btn-teal disabled:opacity-60">
              {prodSubmitting ? 'Recording…' : 'Record production'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Production ${detail?.assemblyNumber || ''}`} width="max-w-2xl">
        {detail && (
          <div className="flex flex-col gap-4">
            {detailError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{detailError}</div>}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Product</p>
                <p className="font-medium">{detail.product?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs">Date</p>
                <p className="font-medium">{new Date(detail.date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Warehouse</p>
                <p className="font-medium">{detail.warehouse?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs">Quantity Produced</p>
                <p className="font-medium font-figures">{detail.quantity}</p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-2">Component consumed</th>
                  <th className="text-right">Qty / unit</th>
                  <th className="text-right">Qty used</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {detail.components.map((c, i) => (
                  <tr key={c.product?._id ? `${c.product._id}-${i}` : i} className="border-b border-slate-100">
                    <td className="py-2">{c.product?.name}</td>
                    <td className="text-right font-figures">{c.quantityPerUnit}</td>
                    <td className="text-right font-figures">{c.quantityUsed}</td>
                    <td className="text-right font-figures">{money(c.unitCost * c.quantityUsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200 pt-3 flex justify-end gap-6 text-sm">
              <span className="text-slate-600">Total component cost</span>
              <span className="font-figures w-24 text-right">{money(detail.totalCost)}</span>
            </div>
            <div className="flex justify-end gap-6 text-sm">
              <span className="text-slate-600">Unit cost of finished good</span>
              <span className="font-figures w-24 text-right">{money(detail.unitCost)}</span>
            </div>

            {detail.note && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-slate-500 text-xs">Note</p>
                <p>{detail.note}</p>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <Badge status={detail.status} />
              {canManage && detail.status === 'POSTED' && (
                <button onClick={() => handleVoidClick(detail._id)} className="btn-ghost text-ledger-rose">Void</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={bomModalOpen} onClose={() => !bomSubmitting && setBomModalOpen(false)} title={editingBom ? 'Edit Bill of Materials' : 'New Bill of Materials'} width="max-w-2xl">
        <div className="flex flex-col gap-4">
          {bomError && <div className="text-sm bg-ledger-roseLight text-ledger-rose px-3 py-2 rounded-lg">{bomError}</div>}
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Finished product</span>
            <select value={bomProduct} onChange={(e) => setBomProduct(e.target.value)} className="input" disabled={!!editingBom}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">Components (per 1 unit produced)</span>
              <button onClick={addBomLine} type="button" className="text-xs text-ledger-teal hover:underline">+ Add component</button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: 'minmax(0,3fr) minmax(0,1.2fr) 32px' }}>
                <span>Component</span>
                <span>Qty</span>
                <span className="sr-only">Delete</span>
              </div>
              {bomLines.map((line, i) => (
                <div key={line._key} className="grid gap-2 items-center" style={{ gridTemplateColumns: 'minmax(0,3fr) minmax(0,1.2fr) 32px' }}>
                  <select value={line.component} onChange={(e) => updateBomLine(i, { component: e.target.value })} className="input">
                    <option value="">Product…</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <input type="number" min="0" step="0.001" value={line.quantity} onChange={(e) => updateBomLine(i, { quantity: Number(e.target.value) })} className="input font-figures" />
                  <button type="button" onClick={() => removeBomLine(i)} className="text-slate-400 hover:text-ledger-rose flex justify-center h-[42px] items-center">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Notes</span>
            <input value={bomNotes} onChange={(e) => setBomNotes(e.target.value)} className="input" />
          </label>

          <div className="flex justify-end gap-2">
            <button disabled={bomSubmitting} onClick={saveBom} className="btn-teal disabled:opacity-60">
              {bomSubmitting ? 'Saving…' : editingBom ? 'Save changes' : 'Create recipe'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Action"
        message={confirmMessage}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </PageLayout>
  );
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

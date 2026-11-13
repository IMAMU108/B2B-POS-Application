import { useMemo, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import type { SkuItem } from '../types/pos';
import { formatNaira } from '../utils/formatters';

interface InventoryViewProps {
  skus: SkuItem[];
  onAdjustStock: (skuId: string, delta: number) => void;
  onAddSku: (newSku: Omit<SkuItem, 'aliases'> & { aliasesText?: string }) => void;
}

export function InventoryView({
  skus,
  onAdjustStock,
  onAddSku,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low'>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const [formState, setFormState] = useState({
    sku_id: '',
    barcode: '',
    name: '',
    category: 'Grains & Staples',
    unit_label: 'Carton',
    unit_price: '',
    cost_price: '',
    stock_qty: '',
    reorder_level: '5',
    aliasesText: '',
  });

  const filteredSkus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skus.filter((sku) => {
      if (filterMode === 'low' && sku.stock_qty > sku.reorder_level) {
        return false;
      }
      if (!q) return true;
      return (
        sku.sku_id.toLowerCase().includes(q) ||
        sku.name.toLowerCase().includes(q) ||
        sku.barcode.includes(q) ||
        sku.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [filterMode, search, skus]);

  function handleSubmitNewSku(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.sku_id.trim() || !formState.name.trim()) return;
    onAddSku({
      sku_id: formState.sku_id,
      barcode: formState.barcode || String(Date.now()).slice(0, 13),
      name: formState.name,
      category: formState.category,
      unit_label: formState.unit_label,
      unit_price: Number(formState.unit_price) || 0,
      cost_price: Number(formState.cost_price) || 0,
      stock_qty: Number(formState.stock_qty) || 0,
      reorder_level: Number(formState.reorder_level) || 5,
      aliasesText: formState.aliasesText,
    });
    setFormState({
      sku_id: '',
      barcode: '',
      name: '',
      category: 'Grains & Staples',
      unit_label: 'Carton',
      unit_price: '',
      cost_price: '',
      stock_qty: '',
      reorder_level: '5',
      aliasesText: '',
    });
    setShowAddForm(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, barcode, or Hausa alias..."
              className="pl-9 pr-3 py-2 w-72 max-w-full text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All SKUs ({skus.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('low')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filterMode === 'low'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Low Stock
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{showAddForm ? 'Close Form' : 'Add SKU'}</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmitNewSku}
          className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              SKU ID
            </label>
            <input
              required
              type="text"
              value={formState.sku_id}
              onChange={(e) => setFormState({ ...formState, sku_id: e.target.value })}
              placeholder="SKU-PEAK-CHOCO"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Product Name
            </label>
            <input
              required
              type="text"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="Peak Choco Sachet (Roll/10)"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Sell Price (₦)
            </label>
            <input
              required
              type="number"
              min="0"
              value={formState.unit_price}
              onChange={(e) =>
                setFormState({ ...formState, unit_price: e.target.value })
              }
              placeholder="2500"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Initial Stock
            </label>
            <input
              required
              type="number"
              min="0"
              value={formState.stock_qty}
              onChange={(e) =>
                setFormState({ ...formState, stock_qty: e.target.value })
              }
              placeholder="20"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Barcode / EAN
            </label>
            <input
              type="text"
              value={formState.barcode}
              onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
              placeholder="6151100099112"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cost Price (₦)
            </label>
            <input
              type="number"
              min="0"
              value={formState.cost_price}
              onChange={(e) =>
                setFormState({ ...formState, cost_price: e.target.value })
              }
              placeholder="2200"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Hausa / Pidgin Aliases (comma separated)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formState.aliasesText}
                onChange={(e) =>
                  setFormState({ ...formState, aliasesText: e.target.value })
                }
                placeholder="peak choco, tea sachet, choco"
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
              >
                Save SKU
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-left">
                <th className="px-5 py-3 font-medium">SKU / Barcode</th>
                <th className="px-3 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium text-right">Sell Price</th>
                <th className="px-3 py-3 font-medium text-right">Cost Price</th>
                <th className="px-3 py-3 font-medium text-right">In Stock</th>
                <th className="px-5 py-3 font-medium text-right">Quick Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSkus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No matching SKUs found. Try clearing your search filter or add a new
                    SKU.
                  </td>
                </tr>
              ) : (
                filteredSkus.map((sku) => {
                  const isLow = sku.stock_qty <= sku.reorder_level;
                  return (
                    <tr key={sku.sku_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-mono font-medium text-slate-900">
                          {sku.sku_id}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {sku.barcode}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{sku.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Aliases: {sku.aliases.join(', ')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                        {sku.category}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {formatNaira(sku.unit_price)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {formatNaira(sku.cost_price)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={
                            isLow ? 'font-semibold text-red-600' : 'text-slate-900'
                          }
                        >
                          {sku.stock_qty} {sku.unit_label}
                          {sku.stock_qty === 1 ? '' : 's'}
                        </span>
                        {isLow && (
                          <span className="block text-[11px] font-sans text-red-600">
                            Low (Min {sku.reorder_level})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onAdjustStock(sku.sku_id, -1)}
                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                            aria-label={`Decrease stock for ${sku.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onAdjustStock(sku.sku_id, 5)}
                            className="px-2 py-1 text-[11px] font-mono rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            +5
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

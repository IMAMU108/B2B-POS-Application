import { useMemo, useState } from 'react';
import { Lock, Minus, Plus, Search } from 'lucide-react';
import type { SkuItem } from '../types/pos';
import { formatNaira } from '../utils/formatters';
import type { UserRole } from './SecurityView';

interface InventoryViewProps {
  skus: SkuItem[];
  userRole: UserRole;
  onAdjustStock: (skuId: string, delta: number) => void;
  onAddSku: (newSku: Omit<SkuItem, 'aliases'> & { aliasesText?: string }) => void;
}

export function InventoryView({
  skus,
  userRole,
  onAdjustStock,
  onAddSku,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const isOwner = userRole === 'OWNER';

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
    <div className="w-full max-w-md md:max-w-none mx-auto space-y-4 sm:space-y-5 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, barcode, or Hausa alias..."
              className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#059669]"
            />
          </div>

          <div className="grid grid-cols-2 sm:inline-flex items-center p-1 bg-slate-100 rounded-lg gap-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`min-h-[44px] px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-[#FFFFFF] text-[#0F172A] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              All SKUs ({skus.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('low')}
              className={`min-h-[44px] px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                filterMode === 'low'
                  ? 'bg-[#FFFFFF] text-[#D97706] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              Low Stock
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{showAddForm ? 'Close Form' : 'Add SKU'}</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmitNewSku}
          className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5"
        >
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              SKU ID
            </label>
            <input
              required
              type="text"
              value={formState.sku_id}
              onChange={(e) => setFormState({ ...formState, sku_id: e.target.value })}
              placeholder="SKU-PEAK-CHOCO"
              className="w-full min-h-[44px] px-3 text-xs border border-[#E2E8F0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Product Name
            </label>
            <input
              required
              type="text"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="Peak Choco Sachet (Roll/10)"
              className="w-full min-h-[44px] px-3 text-xs border border-[#E2E8F0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
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
              className="w-full min-h-[44px] px-3 text-xs font-semibold tabular-nums border border-[#E2E8F0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
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
              className="w-full min-h-[44px] px-3 text-xs font-semibold tabular-nums border border-[#E2E8F0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Barcode / EAN
            </label>
            <input
              type="text"
              value={formState.barcode}
              onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
              placeholder="6151100099112"
              className="w-full min-h-[44px] px-3 text-xs border border-[#E2E8F0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
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
              className="w-full min-h-[44px] px-3 text-xs font-semibold tabular-nums border border-[#E2E8F0] rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">
              Hausa / Pidgin Aliases (comma separated)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={formState.aliasesText}
                onChange={(e) =>
                  setFormState({ ...formState, aliasesText: e.target.value })
                }
                placeholder="peak choco, tea sachet, choco"
                className="flex-1 min-h-[44px] px-3 text-xs border border-[#E2E8F0] rounded-lg"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg whitespace-nowrap shrink-0"
              >
                Save SKU
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Mobile Single-Column SKU Cards */}
      <div className="space-y-3 md:hidden">
        {filteredSkus.length === 0 ? (
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl px-4 py-8 text-center text-xs text-slate-500">
            No matching SKUs found. Try clearing your search filter or add a new SKU.
          </div>
        ) : (
          filteredSkus.map((sku) => {
            const isLow = sku.stock_qty <= sku.reorder_level;
            return (
              <div
                key={sku.sku_id}
                className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] leading-snug">
                      {sku.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {sku.sku_id} · {sku.barcode}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-[#0F172A] tabular-nums">
                      {formatNaira(sku.unit_price)}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {isOwner ? (
                        `Cost ${formatNaira(sku.cost_price)}`
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <Lock className="h-3 w-3" />
                          Cost Locked
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-xs">
                    <span
                      className={`font-bold tabular-nums ${
                        isLow ? 'text-[#D97706]' : 'text-[#0F172A]'
                      }`}
                    >
                      {sku.stock_qty} {sku.unit_label}
                      {sku.stock_qty === 1 ? '' : 's'}
                    </span>
                    {isLow && (
                      <span className="ml-2 font-semibold text-[#D97706]">
                        Low (Min {sku.reorder_level})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAdjustStock(sku.sku_id, -1)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-50 active:bg-slate-100"
                      aria-label={`Decrease stock for ${sku.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjustStock(sku.sku_id, 5)}
                      className="min-h-[44px] min-w-[44px] px-3 text-xs font-bold rounded-lg border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-50 active:bg-slate-100"
                    >
                      +5
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-slate-600 text-left">
                <th className="px-5 py-3 font-semibold">SKU / Barcode</th>
                <th className="px-3 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 font-semibold text-right">Sell Price</th>
                <th className="px-3 py-3 font-semibold text-right">Cost Price</th>
                <th className="px-3 py-3 font-semibold text-right">In Stock</th>
                <th className="px-5 py-3 font-semibold text-right">Quick Adjust</th>
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
                    <tr key={sku.sku_id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-semibold text-[#0F172A]">
                          {sku.sku_id}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sku.barcode}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-[#0F172A]">{sku.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Aliases: {sku.aliases.join(', ')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                        {sku.category}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-[#0F172A] tabular-nums whitespace-nowrap">
                        {formatNaira(sku.unit_price)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        {isOwner ? (
                          <span className="text-slate-600">
                            {formatNaira(sku.cost_price)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={
                            isLow
                              ? 'font-bold text-[#D97706]'
                              : 'font-semibold text-[#0F172A]'
                          }
                        >
                          {sku.stock_qty} {sku.unit_label}
                          {sku.stock_qty === 1 ? '' : 's'}
                        </span>
                        {isLow && (
                          <span className="block text-[11px] font-semibold text-[#D97706]">
                            Low (Min {sku.reorder_level})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onAdjustStock(sku.sku_id, -1)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-100"
                            aria-label={`Decrease stock for ${sku.name}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onAdjustStock(sku.sku_id, 5)}
                            className="min-h-[44px] min-w-[44px] px-2.5 text-xs font-bold rounded-lg border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-100"
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

import { Fragment, useMemo, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import type { LedgerEntry, PosAction } from '../types/pos';
import {
  formatNaira,
  formatShortDate,
  getActionLabel,
  getActionTextClass,
} from '../utils/formatters';

interface LedgerViewProps {
  ledger: LedgerEntry[];
  onResetDemo: () => void;
}

const ACTION_FILTERS: Array<{ id: 'ALL' | PosAction; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'ADD_SALE', label: 'Sales' },
  { id: 'ADD_CREDIT_SALE', label: 'Credit' },
  { id: 'RESTOCK', label: 'Restock' },
  { id: 'ADD_DEBTOR_PAYMENT', label: 'Debt Paid' },
];

export function LedgerView({ ledger, onResetDemo }: LedgerViewProps) {
  const [actionFilter, setActionFilter] = useState<'ALL' | PosAction>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledger.filter((entry) => {
      if (actionFilter !== 'ALL' && entry.payload.action !== actionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.id.toLowerCase().includes(q) ||
        entry.raw_input.toLowerCase().includes(q) ||
        (entry.payload.customer_name ?? '').toLowerCase().includes(q) ||
        entry.payload.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [actionFilter, ledger, search]);

  function handleDownloadCsv() {
    const header = [
      'TxnID',
      'Timestamp',
      'Action',
      'Customer',
      'PaymentMethod',
      'TotalNGN',
      'Engine',
      'Synced',
      'Notes',
    ];
    const rows = filtered.map((e) => [
      e.id,
      e.created_at,
      e.payload.action,
      e.payload.customer_name ?? 'Walk-in',
      e.payload.payment_method,
      String(e.total_amount),
      e.engine,
      String(e.synced),
      `"${e.payload.notes.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kasuwapos_ledger.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full max-w-md md:max-w-none mx-auto space-y-4 sm:space-y-5 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, item, or transcript..."
              className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#059669]"
            />
          </div>

          <div className="grid grid-cols-3 sm:inline-flex items-center p-1 bg-slate-100 rounded-lg gap-1">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActionFilter(f.id)}
                className={`min-h-[44px] px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  actionFilter === f.id
                    ? 'bg-[#FFFFFF] text-[#0F172A] shadow-xs'
                    : 'text-slate-600 hover:text-[#0F172A]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={onResetDemo}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-slate-600 hover:text-[#0F172A] hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Mobile Single-Column Ledger Cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl px-4 py-8 text-center text-xs text-slate-500">
            No ledger entries match the current filter.
          </div>
        ) : (
          filtered.map((entry) => {
            const isOpen = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-4 space-y-2.5 min-w-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold ${getActionTextClass(entry.payload.action)}`}
                    >
                      {getActionLabel(entry.payload.action)}
                    </p>
                    <p className="text-sm font-bold text-[#0F172A] truncate mt-0.5">
                      {entry.payload.customer_name ?? 'Walk-in'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {entry.id} · {formatShortDate(entry.created_at)} ·{' '}
                      <span
                        className={`font-semibold ${
                          entry.synced ? 'text-[#059669]' : 'text-[#D97706]'
                        }`}
                      >
                        {entry.synced ? 'Synced' : 'Queued'}
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-[#0F172A] tabular-nums">
                      {formatNaira(entry.total_amount)}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                      {entry.payload.payment_method}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{entry.raw_input}</p>

                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : entry.id)}
                  className="w-full min-h-[44px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#059669] hover:bg-slate-100"
                >
                  {isOpen ? 'Hide Items' : `View Items (${entry.payload.items.length})`}
                </button>

                {isOpen && (
                  <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2">
                    {entry.payload.items.map((item, idx) => (
                      <div
                        key={`${item.sku_id}-${idx}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0F172A] truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {item.quantity} × {formatNaira(item.unit_price)}
                          </p>
                        </div>
                        <span className="font-bold text-[#0F172A] tabular-nums shrink-0">
                          {formatNaira(item.quantity * item.unit_price)}
                        </span>
                      </div>
                    ))}
                    {entry.payload.notes && (
                      <p className="text-[11px] text-slate-500 pt-1 border-t border-[#E2E8F0]">
                        Note: {entry.payload.notes}
                      </p>
                    )}
                  </div>
                )}
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
                <th className="px-5 py-3 font-semibold">Txn / Time</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Raw Input</th>
                <th className="px-3 py-3 font-semibold">Payment</th>
                <th className="px-3 py-3 font-semibold text-right">Amount</th>
                <th className="px-5 py-3 font-semibold text-right">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No ledger entries match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const isOpen = expandedId === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <tr className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="font-semibold text-[#0F172A]">
                            {entry.id}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatShortDate(entry.created_at)} ·{' '}
                            <span
                              className={`font-semibold ${
                                entry.synced ? 'text-[#059669]' : 'text-[#D97706]'
                              }`}
                            >
                              {entry.synced ? 'Synced' : 'Queued'}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`px-3 py-3 font-semibold whitespace-nowrap ${getActionTextClass(entry.payload.action)}`}
                        >
                          {getActionLabel(entry.payload.action)}
                        </td>
                        <td className="px-3 py-3 text-[#0F172A] whitespace-nowrap">
                          {entry.payload.customer_name ?? 'Walk-in'}
                        </td>
                        <td className="px-3 py-3 text-slate-600 max-w-xs truncate">
                          {entry.raw_input}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-600 whitespace-nowrap">
                          {entry.payload.payment_method}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-[#0F172A] whitespace-nowrap">
                          {formatNaira(entry.total_amount)}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isOpen ? null : entry.id)}
                            className="min-h-[44px] px-2 text-xs font-semibold text-[#059669] hover:underline"
                          >
                            {isOpen
                              ? 'Hide Items'
                              : `View (${entry.payload.items.length})`}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-[#F8FAFC]">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="space-y-1.5">
                              {entry.payload.items.map((item, idx) => (
                                <div
                                  key={`${item.sku_id}-${idx}`}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-[#0F172A]">
                                    {item.name} ({item.quantity} ×{' '}
                                    {formatNaira(item.unit_price)})
                                  </span>
                                  <span className="font-bold text-[#0F172A] tabular-nums">
                                    {formatNaira(item.quantity * item.unit_price)}
                                  </span>
                                </div>
                              ))}
                              {entry.payload.notes && (
                                <p className="text-[11px] text-slate-500 pt-1">
                                  Note: {entry.payload.notes}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, item, or transcript..."
              className="pl-9 pr-3 py-2 w-64 max-w-full text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-lg">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActionFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  actionFilter === f.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={onResetDemo}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-left">
                <th className="px-5 py-3 font-medium">Txn / Time</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Raw Input</th>
                <th className="px-3 py-3 font-medium">Payment</th>
                <th className="px-3 py-3 font-medium text-right">Amount</th>
                <th className="px-5 py-3 font-medium text-right">JSON</th>
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
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="font-mono font-medium text-slate-900">
                            {entry.id}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatShortDate(entry.created_at)} ·{' '}
                            <span
                              className={
                                entry.synced ? 'text-emerald-700' : 'text-amber-700'
                              }
                            >
                              {entry.synced ? 'Synced' : 'Queued'}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`px-3 py-3 font-medium whitespace-nowrap ${getActionTextClass(entry.payload.action)}`}
                        >
                          {getActionLabel(entry.payload.action)}
                        </td>
                        <td className="px-3 py-3 text-slate-800 whitespace-nowrap">
                          {entry.payload.customer_name ?? 'Walk-in'}
                        </td>
                        <td className="px-3 py-3 text-slate-600 max-w-xs truncate">
                          {entry.raw_input}
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-600 whitespace-nowrap">
                          {entry.payload.payment_method}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                          {formatNaira(entry.total_amount)}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isOpen ? null : entry.id)}
                            className="text-xs font-medium text-emerald-700 hover:underline"
                          >
                            {isOpen ? 'Hide JSON' : 'Inspect JSON'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="px-5 py-3">
                            <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-xs overflow-x-auto">
                              <code>{JSON.stringify(entry.payload, null, 2)}</code>
                            </pre>
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

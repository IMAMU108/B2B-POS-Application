import {
  BookOpen,
  Boxes,
  FileSpreadsheet,
  TerminalSquare,
  X,
} from 'lucide-react';
import { formatNaira } from '../utils/formatters';

export type WorkspaceTab = 'parser' | 'inventory' | 'debtors' | 'ledger';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  metrics: {
    cashAndTransferSales: number;
    outstandingDebt: number;
    lowStockCount: number;
    unsyncedCount: number;
  };
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof TerminalSquare;
}> = [
  { id: 'parser', label: 'Edge AI Parser', icon: TerminalSquare },
  { id: 'inventory', label: 'Inventory & SKUs', icon: Boxes },
  { id: 'debtors', label: 'Debtors & Credit', icon: BookOpen },
  { id: 'ledger', label: 'Ledger & Sync', icon: FileSpreadsheet },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  metrics,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 px-4 py-5">
      <div>
        <div className="flex items-center justify-between px-2 pb-6 border-b border-slate-100">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            KasuwaPOS
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="mt-5 space-y-1" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const badge =
              item.id === 'inventory' && metrics.lowStockCount > 0
                ? String(metrics.lowStockCount)
                : item.id === 'ledger' && metrics.unsyncedCount > 0
                  ? String(metrics.unsyncedCount)
                  : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {badge && (
                  <span className="font-mono text-xs tabular-nums text-amber-700">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-200 px-2 space-y-3">
        <div>
          <p className="text-xs text-slate-500">Cash & Transfer Volume</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
            {formatNaira(metrics.cashAndTransferSales)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Outstanding Credit Book</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-amber-700 tabular-nums">
            {formatNaira(metrics.outstandingDebt)}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[80vw] h-full">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

import { Menu, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { WorkspaceTab } from './Sidebar';

interface TopBarProps {
  activeTab: WorkspaceTab;
  isOffline: boolean;
  onToggleOffline: () => void;
  unsyncedCount: number;
  onSyncQueue: () => void;
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<WorkspaceTab, string> = {
  parser: 'Edge AI Parsing Engine',
  inventory: 'Inventory & SKU Catalog',
  debtors: 'Debtors & Credit Book',
  ledger: 'Transaction Ledger & Sync Queue',
};

export function TopBar({
  activeTab,
  isOffline,
  onToggleOffline,
  unsyncedCount,
  onSyncQueue,
  onOpenMobileMenu,
}: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
            KasuwaPOS
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {unsyncedCount > 0 && (
          <button
            type="button"
            onClick={onSyncQueue}
            disabled={isOffline}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Queue ({unsyncedCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleOffline}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
            isOffline
              ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          {isOffline ? (
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Wifi className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{isOffline ? 'Offline Edge' : 'Online Edge'}</span>
        </button>
      </div>
    </header>
  );
}

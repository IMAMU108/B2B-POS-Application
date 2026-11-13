import { Database, Menu, RefreshCw, Wifi } from 'lucide-react';
import type { WorkspaceTab } from './Sidebar';

interface TopBarProps {
  activeTab: WorkspaceTab;
  isOffline: boolean;
  onToggleOffline: () => void;
  unsyncedCount: number;
  onSyncQueue: () => void;
  onOpenMobileMenu: () => void;
}

export function TopBar({
  isOffline,
  onToggleOffline,
  unsyncedCount,
  onSyncQueue,
  onOpenMobileMenu,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-14 w-full bg-[#0F172A] text-white border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-[13px] sm:text-base font-bold text-white truncate">
          Maman Ummi Wholesale
        </h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {unsyncedCount > 0 && !isOffline && (
          <button
            type="button"
            onClick={onSyncQueue}
            className="min-h-[44px] inline-flex items-center gap-1 px-2.5 text-[11px] sm:text-xs font-semibold rounded-lg bg-[#D97706] text-white hover:bg-amber-600 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            <span className="tabular-nums">Sync ({unsyncedCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleOffline}
          className={`min-h-[44px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            isOffline
              ? 'bg-[#059669] text-white hover:bg-[#047857]'
              : 'bg-slate-800 text-emerald-300 border border-[#059669]/60 hover:bg-slate-700'
          }`}
          title="Toggle between Offline SQLite mode and Online Cloud sync"
        >
          {isOffline ? (
            <Database className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Wifi className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {isOffline ? 'Offline - SQLite Active' : 'Online · Cloud Sync'}
          </span>
        </button>
      </div>
    </header>
  );
}

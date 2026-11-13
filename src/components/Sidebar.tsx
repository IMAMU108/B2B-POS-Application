import {
  BarChart3,
  BookOpen,
  Boxes,
  FileSpreadsheet,
  Shield,
  ShoppingCart,
  X,
} from 'lucide-react';
import { formatNaira } from '../utils/formatters';
import type { UserRole } from './SecurityView';

export type WorkspaceTab =
  | 'parser'
  | 'analytics'
  | 'inventory'
  | 'debtors'
  | 'ledger'
  | 'security';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userRole: UserRole;
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
  icon: typeof ShoppingCart;
}> = [
  { id: 'parser', label: 'POS Checkout', icon: ShoppingCart },
  { id: 'analytics', label: 'Owner Analytics', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory & SKUs', icon: Boxes },
  { id: 'debtors', label: 'Customer Credit Book', icon: BookOpen },
  { id: 'ledger', label: 'Ledger & Sync', icon: FileSpreadsheet },
  { id: 'security', label: 'Security & RBAC', icon: Shield },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  userRole,
  metrics,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col justify-between bg-[#FFFFFF] border-r border-[#E2E8F0]">
      <div>
        <div className="h-14 bg-[#0F172A] px-4 flex items-center justify-between border-b border-slate-800">
          <span className="text-sm font-bold tracking-tight text-white truncate">
            Maman Ummi Wholesale
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 shrink-0"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-4 px-3 space-y-1.5" aria-label="Workspace navigation">
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
                className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-50 text-[#059669] font-semibold'
                    : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-[#059669]' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {badge && (
                  <span className="text-xs font-bold tabular-nums text-[#D97706]">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-[#E2E8F0] space-y-3">
        <div>
          <p className="text-[11px] font-medium text-slate-500">Active Role</p>
          <p className="mt-0.5 text-xs font-bold text-[#0F172A] truncate">
            {userRole === 'OWNER'
              ? 'Maman Ummi - Store Owner'
              : 'Ibrahim - Sales Attendant'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Cash &amp; Transfer Sales</p>
          <p className="mt-0.5 text-lg font-bold text-[#0F172A] tabular-nums">
            {formatNaira(metrics.cashAndTransferSales)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Outstanding Credit Book</p>
          <p className="mt-0.5 text-lg font-bold text-[#D97706] tabular-nums">
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
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-72 max-w-[85vw] h-full">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

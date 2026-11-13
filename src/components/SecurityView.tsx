import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  Lock,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Unlock,
  X,
} from 'lucide-react';
import type { LedgerEntry, SkuItem } from '../types/pos';
import { formatNaira } from '../utils/formatters';

export type UserRole = 'ATTENDANT' | 'OWNER';

interface SecurityViewProps {
  userRole: UserRole;
  onUnlockOwner: () => void;
  onLockToAttendant: () => void;
  onOpenPosTerminal: () => void;
  skus: SkuItem[];
  ledger: LedgerEntry[];
}

const OWNER_PIN = '1234';

export function SecurityView({
  userRole,
  onUnlockOwner,
  onLockToAttendant,
  onOpenPosTerminal,
  skus,
  ledger,
}: SecurityViewProps) {
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const financials = useMemo(() => {
    const skuMap = new Map(skus.map((s) => [s.sku_id, s]));
    let totalSalesRevenue = 0;
    let totalWholesaleCogs = 0;

    for (const entry of ledger) {
      if (
        entry.payload.action === 'ADD_SALE' ||
        entry.payload.action === 'ADD_CREDIT_SALE'
      ) {
        totalSalesRevenue += entry.total_amount;
        for (const item of entry.payload.items) {
          const sku = skuMap.get(item.sku_id);
          const unitCost = sku ? sku.cost_price : Math.round(item.unit_price * 0.9);
          totalWholesaleCogs += unitCost * item.quantity;
        }
      }
    }

    const netProfit = Math.max(0, totalSalesRevenue - totalWholesaleCogs);
    const inventoryWholesaleValue = skus.reduce(
      (sum, s) => sum + s.cost_price * s.stock_qty,
      0
    );

    return {
      totalSalesRevenue,
      totalWholesaleCogs,
      netProfit,
      inventoryWholesaleValue,
    };
  }, [ledger, skus]);

  function openPinModal() {
    setPinValue('');
    setPinError(null);
    setPinModalOpen(true);
  }

  function handlePinChange(raw: string) {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 4);
    setPinValue(digitsOnly);
    if (pinError) setPinError(null);
  }

  function handleAuthorizeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pinValue.length !== 4) {
      setPinError('Enter all 4 digits of the Owner PIN.');
      return;
    }
    if (pinValue !== OWNER_PIN) {
      setPinError('Incorrect Owner PIN. Please verify and try again.');
      return;
    }
    setPinError(null);
    setPinModalOpen(false);
    setPinValue('');
    onUnlockOwner();
  }

  const isOwner = userRole === 'OWNER';

  return (
    <div className="w-full max-w-md md:max-w-3xl lg:max-w-none mx-auto space-y-4 sm:space-y-5 min-w-0">
      {/* 1. Prominent Active Session Banner */}
      <section className="bg-[#0F172A] text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
              isOwner
                ? 'bg-[#059669]/20 text-emerald-300 border border-[#059669]/50'
                : 'bg-slate-800 text-amber-300 border border-slate-700'
            }`}
          >
            {isOwner ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">
              Active POS Session
            </p>
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              {isOwner
                ? 'Maman Ummi - Store Owner'
                : 'Ibrahim - Sales Attendant'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {isOwner
                ? 'Full financial & wholesale cost access unlocked'
                : 'Standard cashier permissions · Profit data protected'}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isOwner ? (
            <button
              type="button"
              onClick={onLockToAttendant}
              className="w-full sm:w-auto min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span>Lock to Attendant</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openPinModal}
              className="w-full sm:w-auto min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>Owner Mode (PIN)</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Side-by-side (md+) or Stacked (mobile) Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Card A: POS Checkout Terminal (Unlocked for all roles) */}
        <section className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#0F172A]">
                    POS Checkout Terminal
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cash, Bank Transfer &amp; Credit Sales
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-[#059669] text-xs font-semibold whitespace-nowrap shrink-0">
                <Unlock className="h-3 w-3" />
                <span>Unlocked</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Available to all store attendants and owners. Scan barcodes, search
              wholesale SKUs, process payments, and record offline sales to local
              SQLite storage.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPosTerminal}
            className="w-full min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs sm:text-sm font-semibold transition-colors"
          >
            <span>Open POS Checkout Terminal</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </section>

        {/* Card B: Net Profit & Wholesale Cost (Restricted/Locked for attendants) */}
        <section className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${
                    isOwner
                      ? 'bg-emerald-50 border-emerald-200 text-[#059669]'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {isOwner ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Net Profit &amp; Wholesale Cost
                  </h3>
                  <p className="text-xs text-slate-500">
                    Margin &amp; supplier cost visibility
                  </p>
                </div>
              </div>

              {isOwner ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-[#059669] text-xs font-semibold whitespace-nowrap shrink-0">
                  <Unlock className="h-3 w-3" />
                  <span>Owner Unlocked</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold whitespace-nowrap shrink-0">
                  <Lock className="h-3 w-3" />
                  <span>Restricted</span>
                </span>
              )}
            </div>

            {isOwner ? (
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    Estimated Net Profit
                  </span>
                  <span className="text-xl font-extrabold text-[#059669] tabular-nums">
                    {formatNaira(financials.netProfit)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs pt-2 border-t border-[#E2E8F0]">
                  <span className="text-slate-600">Wholesale Cost (COGS)</span>
                  <span className="font-bold text-[#0F172A] tabular-nums">
                    {formatNaira(financials.totalWholesaleCogs)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-slate-600">Stock Cost Valuation</span>
                  <span className="font-bold text-[#0F172A] tabular-nums">
                    {formatNaira(financials.inventoryWholesaleValue)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-rose-200/80 bg-[#F8FAFC] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    Net Profit Margin
                  </span>
                  <span className="text-base font-bold text-slate-400 tracking-widest select-none">
                    ₦ ••••••
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <span className="text-xs font-medium text-slate-500">
                    Wholesale Cost Price
                  </span>
                  <span className="text-sm font-bold text-slate-400 tracking-widest select-none">
                    ₦ ••••••
                  </span>
                </div>
                <p className="text-[11px] text-rose-700 font-medium pt-1">
                  Locked for Sales Attendant role. Enter Owner PIN to view supplier
                  margins.
                </p>
              </div>
            )}
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={onLockToAttendant}
              className="w-full min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-slate-50 text-[#0F172A] text-xs sm:text-sm font-semibold transition-colors"
            >
              <Lock className="h-4 w-4 shrink-0" />
              <span>Lock Financial View</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openPinModal}
              className="w-full min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span>Unlock with Owner PIN</span>
            </button>
          )}
        </section>
      </div>

      {/* Role Permissions Matrix */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#0F172A]">
          Store Role Permissions Summary
        </h3>
        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-slate-700 font-medium">
              POS Checkout &amp; Barcode Scan
            </span>
            <span className="font-semibold text-[#059669]">Attendant &amp; Owner</span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-slate-700 font-medium">
              Customer Credit Book &amp; Reminders
            </span>
            <span className="font-semibold text-[#059669]">Attendant &amp; Owner</span>
          </div>
          <div className="py-2.5 flex items-center justify-between gap-3">
            <span className="text-slate-700 font-medium">
              Wholesale Cost Prices &amp; Net Profit
            </span>
            <span className="font-semibold text-rose-700">Owner PIN Only</span>
          </div>
        </div>
      </section>

      {/* 3. Overlay Modal: Enter Owner PIN */}
      {pinModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-pin-modal-title"
        >
          <form
            onSubmit={handleAuthorizeSubmit}
            className="w-full max-w-sm bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shrink-0">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    id="owner-pin-modal-title"
                    className="text-base font-bold text-[#0F172A]"
                  >
                    Enter Owner PIN
                  </h3>
                  <p className="text-xs text-slate-500">
                    4-digit passcode required to unlock margins
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0F172A] hover:bg-slate-100"
                aria-label="Close PIN modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="owner-pin-input"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                4-Digit Passcode
              </label>
              <input
                id="owner-pin-input"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                autoFocus
                value={pinValue}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className={`w-full min-h-[52px] px-4 rounded-xl border text-center text-2xl font-bold tracking-[0.55em] tabular-nums bg-[#F8FAFC] text-[#0F172A] focus:bg-[#FFFFFF] focus:outline-none focus:ring-2 ${
                  pinError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-[#E2E8F0] focus:border-[#059669] focus:ring-[#059669]/20'
                }`}
              />
              <p className="text-[11px] text-slate-500 text-center">
                Demo Owner PIN: <span className="font-bold text-[#0F172A]">1234</span>
              </p>
            </div>

            {pinError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="min-h-[44px] px-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-slate-50 text-xs font-semibold text-[#0F172A] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-xs font-semibold text-white transition-colors"
              >
                Authorize
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

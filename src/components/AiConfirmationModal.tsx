import { Sparkles, X } from 'lucide-react';
import type { ParsedPosPayload, PaymentMethod, PosAction } from '../types/pos';
import { computePayloadTotal, formatNaira } from '../utils/formatters';

interface AiConfirmationModalProps {
  payload: ParsedPosPayload;
  rawInput?: string;
  onConfirmAndSave: () => void;
  onEditOrCancel: () => void;
}

function formatActionBadge(action: PosAction, customerName: string | null): {
  text: string;
  className: string;
} {
  const customerSuffix = customerName ? ` - ${customerName}` : '';
  switch (action) {
    case 'ADD_CREDIT_SALE':
      return {
        text: `Credit Sale${customerSuffix}`,
        className: 'bg-amber-50 text-amber-800 border-amber-300',
      };
    case 'ADD_SALE':
      return {
        text: `Cash / Transfer Sale${customerSuffix}`,
        className: 'bg-emerald-50 text-[#059669] border-emerald-200',
      };
    case 'RESTOCK':
      return {
        text: `Inventory Restock${customerSuffix}`,
        className: 'bg-slate-100 text-[#0F172A] border-[#E2E8F0]',
      };
    case 'ADD_DEBTOR_PAYMENT':
      return {
        text: `Debtor Payment${customerSuffix}`,
        className: 'bg-emerald-50 text-[#059669] border-emerald-200',
      };
  }
}

function formatPaymentLabel(method: PaymentMethod): string {
  switch (method) {
    case 'CREDIT':
      return 'Credit';
    case 'TRANSFER':
      return 'Bank Transfer';
    case 'CASH':
      return 'Cash';
  }
}

export function AiConfirmationModal({
  payload,
  rawInput,
  onConfirmAndSave,
  onEditOrCancel,
}: AiConfirmationModalProps) {
  const total = computePayloadTotal(payload);
  const badge = formatActionBadge(payload.action, payload.customer_name);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-parsed-modal-title"
    >
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E2E8F0] rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 1. Header with Sparkle icon & subtitle */}
        <div className="px-4 sm:px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="ai-parsed-modal-title"
                className="text-base font-bold text-[#0F172A] leading-snug"
              >
                AI Voice &amp; Vision Parsed Result
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Please review parsed items before saving to SQLite ledger
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onEditOrCancel}
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0F172A] hover:bg-slate-100 shrink-0"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* 2. Action Type Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-bold ${badge.className}`}
            >
              {badge.text}
            </span>

            {rawInput && (
              <span className="text-[11px] text-slate-500 truncate max-w-full">
                Input: &ldquo;{rawInput}&rdquo;
              </span>
            )}
          </div>

          {/* 3. Itemized Structured List */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] divide-y divide-[#E2E8F0]">
            {payload.items.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No line items detected. Tap Edit / Cancel to adjust.
              </div>
            ) : (
              payload.items.map((item, idx) => {
                const lineTotal = item.quantity * item.unit_price;
                return (
                  <div
                    key={`${item.sku_id}-${idx}`}
                    className="px-3.5 py-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-xs sm:text-sm font-semibold text-[#0F172A] min-w-0">
                      <span className="font-bold tabular-nums">
                        {item.quantity}x
                      </span>{' '}
                      {item.name}{' '}
                      <span className="font-normal text-slate-600 tabular-nums">
                        @ {formatNaira(item.unit_price)}
                      </span>
                    </p>
                    <span className="text-sm font-extrabold text-[#0F172A] tabular-nums shrink-0">
                      = {formatNaira(lineTotal)}
                    </span>
                  </div>
                );
              })
            )}

            <div className="px-3.5 py-2.5 flex items-center justify-between text-xs bg-[#FFFFFF]">
              <span className="font-medium text-slate-500">Customer</span>
              <span className="font-bold text-[#0F172A]">
                {payload.customer_name ?? 'Walk-in Customer'}
              </span>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between text-xs bg-[#FFFFFF]">
              <span className="font-medium text-slate-500">Payment Type</span>
              <span
                className={`font-bold ${
                  payload.payment_method === 'CREDIT'
                    ? 'text-[#D97706]'
                    : 'text-[#059669]'
                }`}
              >
                {formatPaymentLabel(payload.payment_method)}
              </span>
            </div>
          </div>

          {/* Total Row */}
          <div className="flex items-baseline justify-between px-1">
            <span className="text-xs font-semibold text-slate-600">
              Ledger Total
            </span>
            <span className="text-2xl font-extrabold text-[#0F172A] tabular-nums tracking-tight">
              {formatNaira(total)}
            </span>
          </div>
        </div>

        {/* 4. Two Prominent Bottom Buttons */}
        <div className="p-4 sm:px-5 border-t border-[#E2E8F0] bg-[#F8FAFC] grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onEditOrCancel}
            className="min-h-[48px] px-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-slate-100 text-xs sm:text-sm font-semibold text-[#0F172A] transition-colors order-2 sm:order-1"
          >
            Edit / Cancel
          </button>

          <button
            type="button"
            onClick={onConfirmAndSave}
            className="min-h-[48px] px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-xs sm:text-sm font-semibold text-white transition-colors order-1 sm:order-2"
          >
            Confirm &amp; Save to Ledger
          </button>
        </div>
      </div>
    </div>
  );
}

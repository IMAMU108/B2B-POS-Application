import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  History,
  MessageCircle,
  Phone,
  Search,
  X,
} from 'lucide-react';
import type {
  DebtorAccount,
  DebtorStatus,
  LedgerEntry,
  ParsedPosPayload,
  PaymentMethod,
} from '../types/pos';
import {
  formatNaira,
  formatShortDate,
  getActionLabel,
  getActionTextClass,
} from '../utils/formatters';

interface DebtorsViewProps {
  debtors: DebtorAccount[];
  ledger: LedgerEntry[];
  onRecordPayment: (params: {
    payload: ParsedPosPayload;
    rawInput: string;
    modality: 'TEXT' | 'VOICE' | 'OCR';
    engine: 'GEMINI_EDGE' | 'OFFLINE_EDGE';
    latencyMs: number;
  }) => LedgerEntry;
}

function getStatusBadgeClasses(status: DebtorStatus): string {
  switch (status) {
    case 'Overdue':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Pending':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Cleared':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
}

function getEffectiveStatus(debtor: DebtorAccount): DebtorStatus {
  if (debtor.balance <= 0) return 'Cleared';
  return debtor.status || 'Pending';
}

export function DebtorsView({
  debtors,
  ledger,
  onRecordPayment,
}: DebtorsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DebtorStatus>('ALL');

  // WhatsApp reminder drawer/modal state
  const [reminderDebtor, setReminderDebtor] = useState<DebtorAccount | null>(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [copiedReminder, setCopiedReminder] = useState(false);

  // Full customer ledger history drawer/modal state
  const [historyDebtor, setHistoryDebtor] = useState<DebtorAccount | null>(null);

  // Record repayment inline form inside ledger history
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recentNotice, setRecentNotice] = useState<string | null>(null);

  const totalOutstanding = debtors.reduce((sum, d) => sum + d.balance, 0);

  const filteredDebtors = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digitsQuery = q.replace(/\D/g, '');
    return debtors.filter((d) => {
      const effectiveStatus = getEffectiveStatus(d);
      if (statusFilter !== 'ALL' && effectiveStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const nameMatch = d.customer_name.toLowerCase().includes(q);
      const phoneRaw = d.phone ?? '';
      const phoneMatch =
        phoneRaw.toLowerCase().includes(q) ||
        (digitsQuery.length > 0 && phoneRaw.replace(/\D/g, '').includes(digitsQuery));
      return nameMatch || phoneMatch;
    });
  }, [debtors, search, statusFilter]);

  const customerLedgerEntries = useMemo(() => {
    if (!historyDebtor) return [];
    const targetName = historyDebtor.customer_name.toLowerCase();
    return ledger.filter(
      (entry) =>
        (entry.payload.customer_name ?? '').toLowerCase() === targetName
    );
  }, [historyDebtor, ledger]);

  function openWhatsAppReminder(debtor: DebtorAccount) {
    setReminderDebtor(debtor);
    setCopiedReminder(false);
    const defaultMsg =
      debtor.balance > 0
        ? `Hello ${debtor.customer_name}, friendly reminder from Maman Ummi Wholesale regarding your ${getEffectiveStatus(debtor).toLowerCase()} balance of ${formatNaira(debtor.balance)}. Please let us know when you will settle via Cash or Bank Transfer. Nagode!`
        : `Hello ${debtor.customer_name}, thank you for clearing your credit balance with Maman Ummi Wholesale. We appreciate your business!`;
    setReminderMessage(defaultMsg);
  }

  function openFullLedger(debtor: DebtorAccount) {
    setHistoryDebtor(debtor);
    setShowRepaymentForm(false);
    setPaymentAmount(String(debtor.balance > 0 ? debtor.balance : ''));
    setPaymentMethod('TRANSFER');
    setPaymentNotes('Credit balance repayment');
  }

  function handleCopyReminder() {
    navigator.clipboard.writeText(reminderMessage);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 1800);
  }

  function handleConfirmRepayment(e: React.FormEvent) {
    e.preventDefault();
    if (!historyDebtor) return;
    const amount = Math.max(1, Number(paymentAmount) || 0);
    const payload: ParsedPosPayload = {
      action: 'ADD_DEBTOR_PAYMENT',
      items: [
        {
          sku_id: 'DEBT-PAYMENT',
          name: 'Debtor Balance Repayment',
          quantity: 1,
          unit_price: amount,
        },
      ],
      customer_name: historyDebtor.customer_name,
      payment_method: paymentMethod,
      notes: paymentNotes.trim() || `Settled ${formatNaira(amount)}`,
    };

    const entry = onRecordPayment({
      payload,
      rawInput: `${historyDebtor.customer_name} paid ${amount} ${paymentMethod} for debt`,
      modality: 'TEXT',
      engine: 'OFFLINE_EDGE',
      latencyMs: 2,
    });

    setRecentNotice(
      `Recorded ${formatNaira(amount)} repayment from ${historyDebtor.customer_name} (${entry.id}).`
    );
    setShowRepaymentForm(false);
    setHistoryDebtor(null);
  }

  // Keep selected history debtor synchronized with live store updates
  const activeHistoryDebtor = historyDebtor
    ? debtors.find((d) => d.id === historyDebtor.id) ?? historyDebtor
    : null;

  return (
    <div className="w-full max-w-md md:max-w-3xl lg:max-w-none mx-auto space-y-4 sm:space-y-5 min-w-0">
      {/* 1. Header */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">
            Customer Credit Book
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Track informal credit sales and secure repayment histories
          </p>
        </div>

        <div className="md:text-right shrink-0">
          <p className="text-xs font-medium text-slate-500">Total Outstanding</p>
          <p className="text-2xl font-extrabold text-[#D97706] tabular-nums tracking-tight">
            {formatNaira(totalOutstanding)}
          </p>
        </div>
      </div>

      {recentNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-[#059669]"
        >
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{recentNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setRecentNotice(null)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-[#0F172A]"
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. Search Bar & Status Filter */}
      <div className="flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer by name or phone number..."
            aria-label="Search customers by name or phone number"
            className="w-full min-h-[44px] pl-9 pr-3 text-sm bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-[#059669]"
          />
        </div>

        <div className="grid grid-cols-4 sm:inline-flex items-center p-1 bg-slate-100 rounded-lg gap-1 shrink-0">
          {(['ALL', 'Overdue', 'Pending', 'Cleared'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`min-h-[44px] px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-[#FFFFFF] text-[#0F172A] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Customer Debtor Cards */}
      {filteredDebtors.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl px-4 py-10 text-center text-xs text-slate-500">
          No customer accounts match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredDebtors.map((debtor) => {
            const status = getEffectiveStatus(debtor);
            return (
              <article
                key={debtor.id}
                className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-4 flex flex-col justify-between gap-4 min-w-0"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[#0F172A] truncate">
                        {debtor.customer_name}
                      </h3>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600 tabular-nums">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{debtor.phone}</span>
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap shrink-0 ${getStatusBadgeClasses(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Outstanding Balance
                      </p>
                      <p
                        className={`text-2xl font-extrabold tabular-nums tracking-tight ${
                          status === 'Overdue'
                            ? 'text-rose-700'
                            : status === 'Pending'
                              ? 'text-[#D97706]'
                              : 'text-[#059669]'
                        }`}
                      >
                        {formatNaira(debtor.balance)}
                      </p>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 tabular-nums">
                      <p>Credit: {formatNaira(debtor.total_credit)}</p>
                      <p className="text-[#059669] font-medium">
                        Paid: {formatNaira(debtor.total_paid)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Action Buttons: Green WhatsApp Icon Button + Dark View Full Ledger Button */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => openWhatsAppReminder(debtor)}
                    className="min-h-[44px] min-w-[44px] px-3.5 inline-flex items-center justify-center rounded-lg bg-[#059669] hover:bg-[#047857] text-white transition-colors shrink-0"
                    aria-label={`Send WhatsApp payment reminder to ${debtor.customer_name}`}
                    title="Send WhatsApp payment reminder"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openFullLedger(debtor)}
                    className="flex-1 min-h-[44px] px-3.5 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    <History className="h-4 w-4 shrink-0" />
                    <span>View Full Ledger</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* WhatsApp Payment Reminder Modal */}
      {reminderDebtor && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="WhatsApp Payment Reminder"
        >
          <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E2E8F0] rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#0F172A] truncate">
                  WhatsApp Reminder · {reminderDebtor.customer_name}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  {reminderDebtor.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReminderDebtor(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0F172A] hover:bg-slate-100"
                aria-label="Close reminder dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              rows={4}
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs sm:text-sm text-[#0F172A] focus:bg-[#FFFFFF] focus:border-[#059669] focus:outline-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyReminder}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
              >
                {copiedReminder ? (
                  <Check className="h-4 w-4 text-[#059669]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>{copiedReminder ? 'Message Copied' : 'Copy Message'}</span>
              </button>

              <a
                href={`https://wa.me/${(reminderDebtor.phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(
                  reminderMessage
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-[#059669] hover:bg-[#047857] text-xs font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Send on WhatsApp</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Full Customer Ledger History Modal */}
      {activeHistoryDebtor && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Customer Full Ledger History"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-[#FFFFFF] border border-[#E2E8F0] rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 bg-[#0F172A] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold truncate">
                  {activeHistoryDebtor.customer_name} · Ledger History
                </h3>
                <p className="text-xs text-slate-300 tabular-nums">
                  {activeHistoryDebtor.phone} · Balance:{' '}
                  {formatNaira(activeHistoryDebtor.balance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDebtor(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                aria-label="Close ledger history"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {showRepaymentForm && (
                <form
                  onSubmit={handleConfirmRepayment}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-3"
                >
                  <p className="text-xs font-bold text-[#0F172A]">
                    Record Credit Repayment
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Amount (₦)
                      </label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full min-h-[44px] px-3 text-xs font-bold tabular-nums bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value as PaymentMethod)
                        }
                        className="w-full min-h-[44px] px-3 text-xs bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg"
                      >
                        <option value="TRANSFER">Bank Transfer</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRepaymentForm(false)}
                      className="min-h-[44px] px-3 text-xs font-semibold text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg"
                    >
                      Save Repayment
                    </button>
                  </div>
                </form>
              )}

              {customerLedgerEntries.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No individual transaction records logged yet for{' '}
                  {activeHistoryDebtor.customer_name}.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {customerLedgerEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold ${getActionTextClass(
                            entry.payload.action
                          )}`}
                        >
                          {getActionLabel(entry.payload.action)}
                        </span>
                        <span className="text-sm font-extrabold text-[#0F172A] tabular-nums">
                          {formatNaira(entry.total_amount)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {entry.id} · {formatShortDate(entry.created_at)} ·{' '}
                        {entry.payload.payment_method}
                      </p>
                      <div className="pt-1 space-y-1">
                        {entry.payload.items.map((item, idx) => (
                          <p
                            key={`${item.sku_id}-${idx}`}
                            className="text-xs text-slate-700 flex justify-between gap-2"
                          >
                            <span className="truncate">
                              {item.quantity}× {item.name}
                            </span>
                            <span className="tabular-nums font-medium shrink-0">
                              {formatNaira(item.quantity * item.unit_price)}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-2.5 shrink-0">
              {activeHistoryDebtor.balance > 0 && !showRepaymentForm ? (
                <button
                  type="button"
                  onClick={() => setShowRepaymentForm(true)}
                  className="flex-1 min-h-[44px] px-4 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold"
                >
                  Record Repayment
                </button>
              ) : (
                <span className="text-xs font-semibold text-[#059669]">
                  {activeHistoryDebtor.balance === 0 ? 'Balance Cleared' : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => setHistoryDebtor(null)}
                className="min-h-[44px] px-4 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

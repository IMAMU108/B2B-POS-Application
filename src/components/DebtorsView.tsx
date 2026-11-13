import { useState } from 'react';
import { Banknote, Check } from 'lucide-react';
import type { DebtorAccount, LedgerEntry, ParsedPosPayload, PaymentMethod } from '../types/pos';
import { formatNaira, formatShortDate } from '../utils/formatters';

interface DebtorsViewProps {
  debtors: DebtorAccount[];
  onRecordPayment: (params: {
    payload: ParsedPosPayload;
    rawInput: string;
    modality: 'TEXT' | 'VOICE' | 'OCR';
    engine: 'GEMINI_EDGE' | 'OFFLINE_EDGE';
    latencyMs: number;
  }) => LedgerEntry;
}

export function DebtorsView({ debtors, onRecordPayment }: DebtorsViewProps) {
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorAccount | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [recentNotice, setRecentNotice] = useState<string | null>(null);

  const totalOutstanding = debtors.reduce((sum, d) => sum + d.balance, 0);

  function openSettleModal(debtor: DebtorAccount) {
    setSelectedDebtor(debtor);
    setPaymentAmount(String(debtor.balance));
    setPaymentMethod('TRANSFER');
    setPaymentNotes('Debtor balance settlement');
  }

  function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDebtor) return;
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
      customer_name: selectedDebtor.customer_name,
      payment_method: paymentMethod,
      notes: paymentNotes.trim() || `Settled ${formatNaira(amount)}`,
    };

    const entry = onRecordPayment({
      payload,
      rawInput: `${selectedDebtor.customer_name} paid ${amount} ${paymentMethod} for debt`,
      modality: 'TEXT',
      engine: 'OFFLINE_EDGE',
      latencyMs: 2,
    });

    setRecentNotice(
      `Recorded ${formatNaira(amount)} payment from ${selectedDebtor.customer_name} (${entry.id}).`
    );
    setSelectedDebtor(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div>
          <p className="text-xs text-slate-500">Total Outstanding Credit Book</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {formatNaira(totalOutstanding)}
          </p>
        </div>
        <p className="text-xs text-slate-500 max-w-md">
          Credit sales (ADD_CREDIT_SALE) automatically open or increase a customer&apos;s
          balance. Repayments (ADD_DEBTOR_PAYMENT) deduct from their outstanding debt.
        </p>
      </div>

      {recentNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          <Check className="h-4 w-4 shrink-0" />
          <span>{recentNotice}</span>
        </div>
      )}

      {selectedDebtor && (
        <form
          onSubmit={handleConfirmPayment}
          className="bg-white border border-slate-300 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Record Payment · {selectedDebtor.customer_name}
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Current Balance: {formatNaira(selectedDebtor.balance)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount Paid (₦)
              </label>
              <input
                required
                type="number"
                min="1"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                <option value="TRANSFER">TRANSFER</option>
                <option value="CASH">CASH</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedDebtor(null)}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              Confirm Repayment
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-left">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium text-right">Total Credit</th>
                <th className="px-3 py-3 font-medium text-right">Total Repaid</th>
                <th className="px-3 py-3 font-medium text-right">Outstanding</th>
                <th className="px-3 py-3 font-medium">Last Activity</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {debtors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No customer credit accounts yet. Parse an ADD_CREDIT_SALE to track
                    customer credit automatically.
                  </td>
                </tr>
              ) : (
                debtors.map((debtor) => (
                  <tr key={debtor.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">
                        {debtor.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {debtor.id} · {debtor.transactions_count} entries
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">
                      {formatNaira(debtor.total_credit)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700">
                      {formatNaira(debtor.total_paid)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">
                      <span
                        className={
                          debtor.balance > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }
                      >
                        {formatNaira(debtor.balance)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                      {formatShortDate(debtor.last_activity)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {debtor.balance > 0 ? (
                        <button
                          type="button"
                          onClick={() => openSettleModal(debtor)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                          <span>Record Payment</span>
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-medium">Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

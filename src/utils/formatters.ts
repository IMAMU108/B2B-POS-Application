import type { ParsedPosPayload, PosAction } from '../types/pos';

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function computePayloadTotal(payload: ParsedPosPayload): number {
  return payload.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );
}

export function getActionLabel(action: PosAction): string {
  switch (action) {
    case 'ADD_SALE':
      return 'Cash / Transfer Sale';
    case 'ADD_CREDIT_SALE':
      return 'Credit Sale (Bashi)';
    case 'RESTOCK':
      return 'Inventory Restock';
    case 'ADD_DEBTOR_PAYMENT':
      return 'Debtor Payment';
  }
}

export function getActionTextClass(action: PosAction): string {
  switch (action) {
    case 'ADD_SALE':
      return 'text-emerald-700';
    case 'ADD_CREDIT_SALE':
      return 'text-amber-700';
    case 'RESTOCK':
      return 'text-slate-700';
    case 'ADD_DEBTOR_PAYMENT':
      return 'text-sky-700';
  }
}

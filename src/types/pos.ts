export type PosAction =
  | 'ADD_SALE'
  | 'ADD_CREDIT_SALE'
  | 'RESTOCK'
  | 'ADD_DEBTOR_PAYMENT';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CREDIT';

export interface ParsedItem {
  sku_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface ParsedPosPayload {
  action: PosAction;
  items: ParsedItem[];
  customer_name: string | null;
  payment_method: PaymentMethod;
  notes: string;
}

export interface SkuItem {
  sku_id: string;
  barcode: string;
  name: string;
  category: string;
  unit_label: string;
  unit_price: number;
  cost_price: number;
  stock_qty: number;
  reorder_level: number;
  aliases: string[];
}

export interface LedgerEntry {
  id: string;
  created_at: string;
  raw_input: string;
  modality: 'TEXT' | 'VOICE' | 'OCR';
  engine: 'GEMINI_EDGE' | 'OFFLINE_EDGE';
  latency_ms: number;
  synced: boolean;
  payload: ParsedPosPayload;
  total_amount: number;
}

export interface DebtorAccount {
  id: string;
  customer_name: string;
  total_credit: number;
  total_paid: number;
  balance: number;
  last_activity: string;
  transactions_count: number;
}

export interface SamplePrompt {
  id: string;
  label: string;
  language: string;
  modality: 'TEXT' | 'VOICE' | 'OCR';
  text: string;
}

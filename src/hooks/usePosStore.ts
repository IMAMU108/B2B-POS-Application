import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SEED_DEBTORS,
  SEED_LEDGER,
  SEED_SKUS,
} from '../data/seedCatalog';
import type {
  DebtorAccount,
  LedgerEntry,
  ParsedPosPayload,
  SkuItem,
} from '../types/pos';
import { computePayloadTotal } from '../utils/formatters';

const SKUS_KEY = 'kasuwa_pos_skus_v1';
const DEBTORS_KEY = 'kasuwa_pos_debtors_v1';
const LEDGER_KEY = 'kasuwa_pos_ledger_v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function usePosStore() {
  const [skus, setSkus] = useState<SkuItem[]>(() => readStorage(SKUS_KEY, SEED_SKUS));
  const [debtors, setDebtors] = useState<DebtorAccount[]>(() =>
    readStorage(DEBTORS_KEY, SEED_DEBTORS)
  );
  const [ledger, setLedger] = useState<LedgerEntry[]>(() =>
    readStorage(LEDGER_KEY, SEED_LEDGER)
  );
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);

  const isOffline = !browserOnline || simulatedOffline;

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SKUS_KEY, JSON.stringify(skus));
  }, [skus]);

  useEffect(() => {
    localStorage.setItem(DEBTORS_KEY, JSON.stringify(debtors));
  }, [debtors]);

  useEffect(() => {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  }, [ledger]);

  const commitTransaction = useCallback(
    (params: {
      payload: ParsedPosPayload;
      rawInput: string;
      modality: 'TEXT' | 'VOICE' | 'OCR';
      engine: 'GEMINI_EDGE' | 'OFFLINE_EDGE';
      latencyMs: number;
    }): LedgerEntry => {
      const { payload, rawInput, modality, engine, latencyMs } = params;
      const now = new Date().toISOString();
      const totalAmount = computePayloadTotal(payload);
      const id = `TXN-${Math.floor(1000 + Math.random() * 9000)}`;

      const entry: LedgerEntry = {
        id,
        created_at: now,
        raw_input: rawInput,
        modality,
        engine,
        latency_ms: latencyMs,
        synced: !isOffline,
        payload,
        total_amount: totalAmount,
      };

      setLedger((prev) => [entry, ...prev]);

      // Update inventory SKU stock counts
      if (payload.action !== 'ADD_DEBTOR_PAYMENT') {
        setSkus((prev) =>
          prev.map((sku) => {
            const matched = payload.items.filter(
              (item) => item.sku_id.toUpperCase() === sku.sku_id.toUpperCase()
            );
            if (matched.length === 0) return sku;
            const qtyDelta = matched.reduce((sum, item) => sum + item.quantity, 0);
            if (payload.action === 'RESTOCK') {
              const latestCost = matched[matched.length - 1].unit_price;
              return {
                ...sku,
                stock_qty: sku.stock_qty + qtyDelta,
                cost_price: latestCost > 0 ? latestCost : sku.cost_price,
              };
            }
            return {
              ...sku,
              stock_qty: Math.max(0, sku.stock_qty - qtyDelta),
            };
          })
        );
      }

      // Update debtor credit balances
      if (
        (payload.action === 'ADD_CREDIT_SALE' ||
          payload.action === 'ADD_DEBTOR_PAYMENT') &&
        payload.customer_name
      ) {
        const customerName = payload.customer_name.trim();
        setDebtors((prev) => {
          const idx = prev.findIndex(
            (d) => d.customer_name.toLowerCase() === customerName.toLowerCase()
          );

          if (idx === -1) {
            if (payload.action === 'ADD_DEBTOR_PAYMENT') {
              return prev;
            }
            const newDebtor: DebtorAccount = {
              id: `DBT-${String(prev.length + 1).padStart(3, '0')}`,
              customer_name: customerName,
              total_credit: totalAmount,
              total_paid: 0,
              balance: totalAmount,
              last_activity: now,
              transactions_count: 1,
            };
            return [newDebtor, ...prev];
          }

          return prev.map((d, i) => {
            if (i !== idx) return d;
            if (payload.action === 'ADD_CREDIT_SALE') {
              const total_credit = d.total_credit + totalAmount;
              return {
                ...d,
                total_credit,
                balance: Math.max(0, total_credit - d.total_paid),
                last_activity: now,
                transactions_count: d.transactions_count + 1,
              };
            }
            const total_paid = d.total_paid + totalAmount;
            return {
              ...d,
              total_paid,
              balance: Math.max(0, d.total_credit - total_paid),
              last_activity: now,
              transactions_count: d.transactions_count + 1,
            };
          });
        });
      }

      return entry;
    },
    [isOffline]
  );

  const addSku = useCallback((newSku: Omit<SkuItem, 'aliases'> & { aliasesText?: string }) => {
    const aliases = (newSku.aliasesText ?? newSku.name)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    setSkus((prev) => [
      {
        sku_id: newSku.sku_id.trim().toUpperCase(),
        barcode: newSku.barcode.trim(),
        name: newSku.name.trim(),
        category: newSku.category.trim() || 'General Groceries',
        unit_label: newSku.unit_label.trim() || 'Unit',
        unit_price: Number(newSku.unit_price) || 0,
        cost_price: Number(newSku.cost_price) || 0,
        stock_qty: Number(newSku.stock_qty) || 0,
        reorder_level: Number(newSku.reorder_level) || 5,
        aliases,
      },
      ...prev,
    ]);
  }, []);

  const adjustSkuStock = useCallback((skuId: string, delta: number) => {
    setSkus((prev) =>
      prev.map((sku) =>
        sku.sku_id === skuId
          ? { ...sku, stock_qty: Math.max(0, sku.stock_qty + delta) }
          : sku
      )
    );
  }, []);

  const syncOfflineQueue = useCallback(() => {
    if (isOffline) return 0;
    let syncedCount = 0;
    setLedger((prev) =>
      prev.map((entry) => {
        if (!entry.synced) {
          syncedCount += 1;
          return { ...entry, synced: true };
        }
        return entry;
      })
    );
    return syncedCount;
  }, [isOffline]);

  const resetDemoData = useCallback(() => {
    setSkus(SEED_SKUS);
    setDebtors(SEED_DEBTORS);
    setLedger(SEED_LEDGER);
  }, []);

  const metrics = useMemo(() => {
    const cashAndTransferSales = ledger
      .filter((e) => e.payload.action === 'ADD_SALE')
      .reduce((sum, e) => sum + e.total_amount, 0);
    const creditIssued = ledger
      .filter((e) => e.payload.action === 'ADD_CREDIT_SALE')
      .reduce((sum, e) => sum + e.total_amount, 0);
    const outstandingDebt = debtors.reduce((sum, d) => sum + d.balance, 0);
    const lowStockCount = skus.filter((s) => s.stock_qty <= s.reorder_level).length;
    const unsyncedCount = ledger.filter((e) => !e.synced).length;

    return {
      cashAndTransferSales,
      creditIssued,
      outstandingDebt,
      lowStockCount,
      unsyncedCount,
    };
  }, [debtors, ledger, skus]);

  return {
    skus,
    debtors,
    ledger,
    isOffline,
    simulatedOffline,
    setSimulatedOffline,
    metrics,
    commitTransaction,
    addSku,
    adjustSkuStock,
    syncOfflineQueue,
    resetDemoData,
  };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Camera,
  Check,
  CreditCard,
  Landmark,
  Mic,
  MicOff,
  Minus,
  Pencil,
  Plus,
  ScanBarcode,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SAMPLE_PROMPTS } from '../data/seedCatalog';
import type {
  DebtorAccount,
  LedgerEntry,
  ParsedItem,
  ParsedPosPayload,
  PaymentMethod,
  PosAction,
  SkuItem,
} from '../types/pos';
import {
  computePayloadTotal,
  formatNaira,
  formatShortDate,
  getActionLabel,
  getActionTextClass,
} from '../utils/formatters';
import { runOfflineEdgeParser, validatePosPayload } from '../utils/offlineParser';
import { AiConfirmationModal } from './AiConfirmationModal';

interface ParserWorkspaceProps {
  skus: SkuItem[];
  debtors: DebtorAccount[];
  ledger: LedgerEntry[];
  isOffline: boolean;
  metrics: {
    cashAndTransferSales: number;
    outstandingDebt: number;
    lowStockCount: number;
    unsyncedCount: number;
  };
  onCommit: (params: {
    payload: ParsedPosPayload;
    rawInput: string;
    modality: 'TEXT' | 'VOICE' | 'OCR';
    engine: 'GEMINI_EDGE' | 'OFFLINE_EDGE';
    latencyMs: number;
  }) => LedgerEntry;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function ParserWorkspace({
  skus,
  debtors,
  ledger,
  isOffline,
  onCommit,
}: ParserWorkspaceProps) {
  const [cartItems, setCartItems] = useState<ParsedItem[]>(() => [
    {
      sku_id: 'SKU-PEAK-EVAP-24',
      name: 'Peak Milk Crate',
      quantity: 2,
      unit_price: 16800,
    },
    {
      sku_id: 'SKU-IND-ONION-CTN',
      name: 'Indomie Carton',
      quantity: 3,
      unit_price: 8400,
    },
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerName, setCustomerName] = useState<string>('');
  const [saleAction, setSaleAction] = useState<PosAction>('ADD_SALE');
  const [notes, setNotes] = useState<string>('');
  const [isEditingCart, setIsEditingCart] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [aiHelperOpen, setAiHelperOpen] = useState<boolean>(false);

  const [aiInput, setAiInput] = useState<string>(
    '2 Indomie Carton @ 4500 on credit for Malam Musa'
  );
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastParsedMeta, setLastParsedMeta] = useState<{
    engine: 'GEMINI_EDGE' | 'OFFLINE_EDGE';
    latencyMs: number;
    modality: 'TEXT' | 'VOICE' | 'OCR';
  } | null>(null);

  // AI Confirmation Modal state
  const [pendingAiConfirmation, setPendingAiConfirmation] = useState<{
    payload: ParsedPosPayload;
    rawInput: string;
    modality: 'TEXT' | 'VOICE' | 'OCR';
    engine: 'GEMINI_EDGE' | 'OFFLINE_EDGE';
    latencyMs: number;
  } | null>(null);

  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    txnId: string;
    total: number;
    method: PaymentMethod;
  } | null>(null);

  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const knownDebtors = debtors.map((d) => d.customer_name);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return skus.slice(0, 4);
    return skus
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.sku_id.toLowerCase().includes(q) ||
          s.barcode.includes(q) ||
          s.aliases.some((a) => a.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [searchQuery, skus]);

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0
      ),
    [cartItems]
  );

  const totalUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [cartItems]
  );

  function addSkuToCart(sku: SkuItem) {
    setCheckoutSuccess(null);
    setParseError(null);
    setCartItems((prev) => {
      const idx = prev.findIndex((item) => item.sku_id === sku.sku_id);
      if (idx !== -1) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          sku_id: sku.sku_id,
          name: sku.name,
          quantity: 1,
          unit_price: saleAction === 'RESTOCK' ? sku.cost_price : sku.unit_price,
        },
      ];
    });
  }

  function updateCartQuantity(index: number, delta: number) {
    setCheckoutSuccess(null);
    setCartItems((prev) =>
      prev
        .map((item, idx) =>
          idx === index ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function updateCartItemField(
    index: number,
    field: 'name' | 'unit_price',
    value: string
  ) {
    setCartItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === 'name') return { ...item, name: value };
        return { ...item, unit_price: Math.max(0, Number(value) || 0) };
      })
    );
  }

  function selectPaymentMethod(method: PaymentMethod) {
    setPaymentMethod(method);
    if (method === 'CREDIT') {
      setSaleAction('ADD_CREDIT_SALE');
    } else if (saleAction === 'ADD_CREDIT_SALE') {
      setSaleAction('ADD_SALE');
    }
  }

  function handleBarcodeQuickScan(code: string) {
    const cleaned = code.trim();
    if (!cleaned) return;
    const match = skus.find(
      (s) =>
        s.barcode === cleaned ||
        s.sku_id.toLowerCase() === cleaned.toLowerCase()
    );
    if (match) {
      addSkuToCart(match);
      setScannerOpen(false);
      setSearchQuery('');
      return;
    }
    setSearchQuery(cleaned);
    setScannerOpen(false);
  }

  async function runSmartParse(params?: {
    text?: string;
    imageBase64?: string;
    imageMimeType?: string;
    modality?: 'TEXT' | 'VOICE' | 'OCR';
  }) {
    const textToParse = (params?.text ?? aiInput).trim();
    const modality = params?.modality ?? 'TEXT';

    if (!textToParse && !params?.imageBase64) {
      setParseError('Enter order text, scan a barcode, or upload a receipt photo.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setCheckoutSuccess(null);
    const startedAt = performance.now();

    try {
      let validated: ParsedPosPayload;
      let engineUsed: 'GEMINI_EDGE' | 'OFFLINE_EDGE' = 'GEMINI_EDGE';
      let latencyMs = 0;

      if (isOffline) {
        if (!textToParse && params?.imageBase64) {
          throw new Error(
            'Photo OCR requires Online Cloud mode. Switch to Online or enter barcode text.'
          );
        }
        validated = runOfflineEdgeParser(textToParse, skus, knownDebtors);
        engineUsed = 'OFFLINE_EDGE';
        latencyMs = Math.max(4, Math.round(performance.now() - startedAt));
      } else {
        try {
          const response = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: textToParse,
              imageBase64: params?.imageBase64,
              imageMimeType: params?.imageMimeType,
              catalog: skus.map((s) => ({
                sku_id: s.sku_id,
                barcode: s.barcode,
                name: s.name,
                unit_price: s.unit_price,
                cost_price: s.cost_price,
                aliases: s.aliases,
              })),
              knownDebtors,
            }),
          });

          const rawText = await response.text();
          const rawBody = JSON.parse(rawText) as Record<string, unknown>;
          if (!response.ok) {
            throw new Error(
              typeof rawBody?.error === 'string'
                ? rawBody.error
                : 'Parsing failed.'
            );
          }

          validated = validatePosPayload(rawBody);
          const headerLatency = Number(response.headers.get('X-Parse-Latency-Ms'));
          latencyMs =
            Number.isFinite(headerLatency) && headerLatency > 0
              ? headerLatency
              : Math.round(performance.now() - startedAt);
        } catch {
          if (textToParse && !params?.imageBase64) {
            validated = runOfflineEdgeParser(textToParse, skus, knownDebtors);
            engineUsed = 'OFFLINE_EDGE';
            latencyMs = Math.max(5, Math.round(performance.now() - startedAt));
          } else {
            throw new Error('Unable to process receipt image right now.');
          }
        }
      }

      setPendingAiConfirmation({
        payload: validated,
        rawInput: textToParse || '[Receipt / Barcode Vision Scan]',
        modality,
        engine: engineUsed,
        latencyMs,
      });
      setScannerOpen(false);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unable to process entry.');
    } finally {
      setIsParsing(false);
    }
  }

  function handleConfirmAiModal() {
    if (!pendingAiConfirmation) return;
    const entry = onCommit(pendingAiConfirmation);
    setCheckoutSuccess({
      txnId: entry.id,
      total: computePayloadTotal(pendingAiConfirmation.payload),
      method: pendingAiConfirmation.payload.payment_method,
    });
    setPendingAiConfirmation(null);
    setAiHelperOpen(false);
  }

  function handleEditFromAiModal() {
    if (!pendingAiConfirmation) return;
    const { payload, engine, latencyMs, modality } = pendingAiConfirmation;
    setCartItems(payload.items);
    setSaleAction(payload.action);
    setPaymentMethod(payload.payment_method);
    setCustomerName(payload.customer_name ?? '');
    setNotes(payload.notes);
    setLastParsedMeta({ engine, latencyMs, modality });
    setIsEditingCart(true);
    setPendingAiConfirmation(null);
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      setParseError('Add at least one item to the Active Cart before checkout.');
      return;
    }

    if (paymentMethod === 'CREDIT' && !customerName.trim()) {
      setParseError('Enter or select a customer name for Credit Sale.');
      return;
    }

    setParseError(null);

    const payload = validatePosPayload({
      action: paymentMethod === 'CREDIT' ? 'ADD_CREDIT_SALE' : saleAction,
      items: cartItems,
      customer_name: customerName.trim() || null,
      payment_method: paymentMethod,
      notes: notes.trim() || `POS checkout (${paymentMethod})`,
    });

    const entry = onCommit({
      payload,
      rawInput:
        aiInput.trim() && lastParsedMeta
          ? aiInput.trim()
          : `${payload.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')} (${payload.payment_method})`,
      modality: lastParsedMeta?.modality ?? 'TEXT',
      engine: lastParsedMeta?.engine ?? (isOffline ? 'OFFLINE_EDGE' : 'GEMINI_EDGE'),
      latencyMs: lastParsedMeta?.latencyMs ?? 3,
    });

    setCheckoutSuccess({
      txnId: entry.id,
      total: computePayloadTotal(payload),
      method: payload.payment_method,
    });
    setCartItems([]);
    setCustomerName('');
    setNotes('');
    setIsEditingCart(false);
    setSaleAction('ADD_SALE');
    setPaymentMethod('CASH');
    setLastParsedMeta(null);
  }

  function toggleSpeechDictation() {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setParseError('Voice dictation unavailable in this browser. Type your order below.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setParseError(null);
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-NG';
    recognition.onresult = (event) => {
      let combined = '';
      for (let i = 0; i < event.results.length; i += 1) {
        combined += event.results[i][0].transcript + ' ';
      }
      setAiInput(combined.trim());
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? '');
      const base64 = dataUrl.split(',')[1] ?? '';
      runSmartParse({
        imageBase64: base64,
        imageMimeType: file.type || 'image/jpeg',
        modality: 'OCR',
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="w-full max-w-md md:max-w-3xl lg:max-w-none mx-auto space-y-4 min-w-0">
      {/* Checkout Confirmation Banner */}
      {checkoutSuccess && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-[#059669] text-white flex items-center justify-center shrink-0">
              <Check className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0F172A] truncate">
                Sale Saved · {checkoutSuccess.txnId}
              </p>
              <p className="text-xs text-[#059669] font-semibold tabular-nums">
                {formatNaira(checkoutSuccess.total)} ({checkoutSuccess.method})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutSuccess(null)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-[#0F172A] rounded-lg"
            aria-label="Dismiss confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. Barcode Scanner Trigger + Product Search Card */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-3.5 sm:p-4 space-y-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product or barcode..."
              aria-label="Search products"
              className="w-full min-h-[44px] pl-9 pr-3 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-slate-400 focus:bg-[#FFFFFF] focus:border-[#059669] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen((prev) => !prev)}
            className="min-h-[44px] min-w-[44px] px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            aria-label="Open barcode scanner"
          >
            <ScanBarcode className="h-4 w-4 shrink-0" />
            <span>Scan</span>
          </button>
        </div>

        {scannerOpen && (
          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#0F172A]">
                Barcode &amp; Receipt Camera Scanner
              </p>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-[#0F172A]"
                aria-label="Close scanner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelected}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-3 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
              >
                <Camera className="h-4 w-4 shrink-0" />
                <span>Camera Scan</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-3 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span>Upload Slip Photo</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500">
                Quick Test Barcode Tap:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {skus.slice(0, 4).map((sku) => (
                  <button
                    key={sku.sku_id}
                    type="button"
                    onClick={() => handleBarcodeQuickScan(sku.barcode)}
                    className="min-h-[44px] px-3 text-left rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-semibold text-[#0F172A] truncate">
                      {sku.name}
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                      {sku.barcode.slice(-6)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              No matching products for &ldquo;{searchQuery}&rdquo;.
            </p>
          ) : (
            searchResults.map((sku) => (
              <button
                key={sku.sku_id}
                type="button"
                onClick={() => addSkuToCart(sku)}
                className="min-h-[44px] w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-between gap-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-[#0F172A] truncate">
                    {sku.name}
                  </p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {sku.stock_qty} {sku.unit_label}s left
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs sm:text-sm font-bold text-[#0F172A] tabular-nums">
                    {formatNaira(sku.unit_price)}
                  </span>
                  <span className="h-7 w-7 rounded-md bg-[#059669] text-white flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Voice / Vision / Text AI Smart Parse Bar */}
        <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setAiHelperOpen((prev) => !prev)}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] hover:underline"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              {aiHelperOpen
                ? 'Hide AI Voice & Text Parser'
                : 'AI Voice, Pidgin & Hausa Entry'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => runSmartParse({ modality: 'VOICE' })}
            disabled={isParsing}
            className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#059669] hover:bg-emerald-100 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Parse &amp; Review</span>
          </button>
        </div>

        {aiHelperOpen && (
          <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_PROMPTS.slice(0, 2).map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => setAiInput(sample.text)}
                  className="min-h-[44px] px-3 text-left text-xs font-medium rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] hover:bg-slate-50 flex items-center justify-between gap-2"
                >
                  <span className="truncate font-semibold">{sample.label}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {sample.language}
                  </span>
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="e.g. 2 Indomie Carton @ 4500 on credit for Malam Musa"
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5 text-xs sm:text-sm text-[#0F172A] focus:border-[#059669] focus:outline-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleSpeechDictation}
                className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-3 text-xs font-semibold rounded-lg border ${
                  isListening
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A]'
                }`}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span>{isListening ? 'Stop Mic' : 'Speak Order'}</span>
              </button>

              <button
                type="button"
                onClick={() => runSmartParse({ modality: isListening ? 'VOICE' : 'TEXT' })}
                disabled={isParsing}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                <span>
                  {isParsing ? 'Analyzing...' : 'Review AI Parsed Result'}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Split on Desktop / Single Stack on 360px Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* 2. Active Cart Itemized List */}
        <section className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-3.5 sm:p-4 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Active Cart</h2>
              <p className="text-xs text-slate-500 tabular-nums">
                {totalUnits} {totalUnits === 1 ? 'item' : 'items'} ready
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {cartItems.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingCart((prev) => !prev)}
                    className="min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>{isEditingCart ? 'Done' : 'Edit'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCartItems([])}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Clear cart"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {cartItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Active Cart is empty. Search or scan a product above to add items.
            </div>
          ) : (
            <div className="space-y-2.5">
              {cartItems.map((item, idx) => (
                <div
                  key={`${item.sku_id}-${idx}`}
                  className="min-h-[56px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-2"
                >
                  {isEditingCart ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateCartItemField(idx, 'name', e.target.value)
                        }
                        aria-label="Product name"
                        className="sm:col-span-7 min-h-[44px] px-2.5 text-xs bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateCartItemField(idx, 'unit_price', e.target.value)
                        }
                        aria-label="Unit price in Naira"
                        className="sm:col-span-5 min-h-[44px] px-2.5 text-xs font-bold tabular-nums bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#0F172A] truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {formatNaira(item.unit_price)} each
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm sm:text-base font-extrabold text-[#0F172A] tabular-nums">
                          {formatNaira(item.quantity * item.unit_price)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                    <span className="text-[11px] font-medium text-slate-500 truncate">
                      {item.sku_id}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(idx, -1)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] hover:bg-slate-100 active:bg-slate-200"
                        aria-label={`Decrease ${item.name} quantity`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[32px] text-center text-sm font-bold text-[#0F172A] tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(idx, 1)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] hover:bg-slate-100 active:bg-slate-200"
                        aria-label={`Increase ${item.name} quantity`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. Quick Payment Selector + Customer & Desktop Checkout */}
        <section className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl p-3.5 sm:p-4 space-y-4 min-w-0">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Payment Method</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select how the merchant or customer is settling this order
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
            <button
              type="button"
              role="radio"
              aria-checked={paymentMethod === 'CASH'}
              onClick={() => selectPaymentMethod('CASH')}
              className={`min-h-[48px] px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-colors ${
                paymentMethod === 'CASH'
                  ? 'bg-[#059669] text-white border-[#059669]'
                  : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-slate-100'
              }`}
            >
              <Banknote className="h-4 w-4 shrink-0" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={paymentMethod === 'TRANSFER'}
              onClick={() => selectPaymentMethod('TRANSFER')}
              className={`min-h-[48px] px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-colors ${
                paymentMethod === 'TRANSFER'
                  ? 'bg-[#059669] text-white border-[#059669]'
                  : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-slate-100'
              }`}
            >
              <Landmark className="h-4 w-4 shrink-0" />
              <span className="truncate">Bank Transfer</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={paymentMethod === 'CREDIT'}
              onClick={() => selectPaymentMethod('CREDIT')}
              className={`min-h-[48px] px-2 py-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-colors ${
                paymentMethod === 'CREDIT'
                  ? 'bg-[#D97706] text-white border-[#D97706]'
                  : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-slate-100'
              }`}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="truncate">Credit Sale</span>
            </button>
          </div>

          {paymentMethod === 'CREDIT' && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-[#D97706]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Credit Sale records this balance to the customer&apos;s debtor ledger
                offline.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="customer-name-input"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              {paymentMethod === 'CREDIT'
                ? 'Customer Name (Required for Credit Sale)'
                : 'Customer Name (Optional)'}
            </label>
            <input
              id="customer-name-input"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Malam Musa or Walk-in"
              className="w-full min-h-[44px] px-3 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:bg-[#FFFFFF] focus:border-[#059669] focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {debtors.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setCustomerName(d.customer_name)}
                  className="min-h-[44px] px-3 text-xs font-medium rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] hover:bg-slate-50"
                >
                  {d.customer_name}
                </button>
              ))}
            </div>
          </div>

          {parseError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-[#D97706]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          <div className="hidden lg:block pt-3 border-t border-[#E2E8F0] space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Total ({totalUnits} {totalUnits === 1 ? 'item' : 'items'})
              </span>
              <span className="text-3xl font-extrabold text-[#0F172A] tabular-nums tracking-tight">
                {formatNaira(cartTotal)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={cartItems.length === 0}
              className="w-full min-h-[52px] px-4 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-sm font-bold flex items-center justify-between transition-colors"
            >
              <span>
                {paymentMethod === 'CREDIT'
                  ? 'Confirm Credit Sale'
                  : 'Confirm & Save Checkout'}
              </span>
              <span className="text-xl font-extrabold tabular-nums">
                {formatNaira(cartTotal)}
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* Recent Offline SQLite Transactions */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] shadow-xs rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-[#0F172A]">Recent Sales &amp; Ledger</h2>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            Latest {Math.min(4, ledger.length)}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {ledger.slice(0, 4).map((entry) => (
            <div
              key={entry.id}
              className="px-4 py-3 min-h-[44px] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold truncate ${getActionTextClass(entry.payload.action)}`}
                >
                  {getActionLabel(entry.payload.action)} ·{' '}
                  {entry.payload.customer_name ?? 'Walk-in'}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {entry.id} · {formatShortDate(entry.created_at)} ·{' '}
                  {entry.payload.payment_method}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-[#0F172A] tabular-nums">
                  {formatNaira(entry.total_amount)}
                </p>
                <p
                  className={`text-[11px] font-semibold ${
                    entry.synced ? 'text-[#059669]' : 'text-[#D97706]'
                  }`}
                >
                  {entry.synced ? 'Synced' : 'Local SQLite'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Prominent Sticky Bottom Checkout Button with Large Bold Naira Totals */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#E2E8F0] px-3 py-2.5">
        <div className="w-full max-w-md mx-auto">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={cartItems.length === 0}
            className="w-full min-h-[52px] px-4 rounded-xl bg-[#059669] hover:bg-[#047857] active:scale-[0.99] disabled:opacity-50 text-white flex items-center justify-between gap-3 shadow-sm transition-all"
          >
            <span className="text-left">
              <span className="block text-sm font-bold leading-tight">
                {paymentMethod === 'CREDIT' ? 'Save Credit Sale' : 'Checkout Now'}
              </span>
              <span className="block text-[11px] text-emerald-100 font-medium tabular-nums">
                {totalUnits} {totalUnits === 1 ? 'item' : 'items'} ·{' '}
                {paymentMethod === 'TRANSFER'
                  ? 'Bank Transfer'
                  : paymentMethod === 'CREDIT'
                    ? 'Credit Sale'
                    : 'Cash'}
              </span>
            </span>

            <span className="text-xl font-extrabold tabular-nums tracking-tight shrink-0">
              {formatNaira(cartTotal)}
            </span>
          </button>
        </div>
      </div>

      {/* AI Transaction & Stock Confirmation Modal */}
      {pendingAiConfirmation && (
        <AiConfirmationModal
          payload={pendingAiConfirmation.payload}
          rawInput={pendingAiConfirmation.rawInput}
          onConfirmAndSave={handleConfirmAiModal}
          onEditOrCancel={handleEditFromAiModal}
        />
      )}
    </div>
  );
}

import type {
  ParsedItem,
  ParsedPosPayload,
  PaymentMethod,
  PosAction,
  SkuItem,
} from '../types/pos';

const HAUSA_NUMBERS: Record<string, number> = {
  daya: 1,
  guda: 1,
  biyu: 2,
  uku: 3,
  hudu: 4,
  biyar: 5,
  shida: 6,
  bakwai: 7,
  takwas: 8,
  tara: 9,
  goma: 10,
  ashirin: 20,
  talatin: 30,
};

const ENGLISH_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
};

const VALID_ACTIONS: PosAction[] = [
  'ADD_SALE',
  'ADD_CREDIT_SALE',
  'RESTOCK',
  'ADD_DEBTOR_PAYMENT',
];

const VALID_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'TRANSFER', 'CREDIT'];

export function validatePosPayload(raw: unknown): ParsedPosPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Parsed payload is not a JSON object.');
  }

  const obj = raw as Record<string, unknown>;
  const action = String(obj.action ?? '').toUpperCase() as PosAction;
  if (!VALID_ACTIONS.includes(action)) {
    throw new Error(`Invalid action "${String(obj.action)}".`);
  }

  let payment_method = String(obj.payment_method ?? '').toUpperCase() as PaymentMethod;
  if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
    payment_method = action === 'ADD_CREDIT_SALE' ? 'CREDIT' : 'CASH';
  }

  if (action === 'ADD_CREDIT_SALE') {
    payment_method = 'CREDIT';
  }

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items: ParsedItem[] = rawItems
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, idx) => {
      const item = entry as Record<string, unknown>;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unit_price = Math.max(0, Number(item.unit_price) || 0);
      const name = String(item.name ?? `Item ${idx + 1}`).trim() || `Item ${idx + 1}`;
      const sku_id =
        String(item.sku_id ?? `MANUAL-${idx + 1}`).trim() || `MANUAL-${idx + 1}`;
      return {
        sku_id,
        name,
        quantity,
        unit_price,
      };
    });

  const customer_name =
    typeof obj.customer_name === 'string' && obj.customer_name.trim().length > 0
      ? obj.customer_name.trim()
      : null;

  const notes = typeof obj.notes === 'string' ? obj.notes.trim() : '';

  return {
    action,
    items,
    customer_name,
    payment_method,
    notes,
  };
}

function parseNairaNumber(token: string): number {
  const cleaned = token.replace(/,/g, '').trim().toLowerCase();
  if (cleaned.endsWith('k')) {
    const base = parseFloat(cleaned.slice(0, -1));
    return Number.isFinite(base) ? Math.round(base * 1000) : 0;
  }
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : 0;
}

function extractCustomerName(
  text: string,
  knownCustomers: string[]
): string | null {
  const lower = text.toLowerCase();
  for (const known of knownCustomers) {
    if (lower.includes(known.toLowerCase())) {
      return known;
    }
    const firstTwo = known.toLowerCase().split(' ').slice(0, 2).join(' ');
    if (firstTwo.length > 4 && lower.includes(firstTwo)) {
      return known;
    }
  }

  const patterns = [
    /(?:cust(?:omer)?\s*[:=-]\s*)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/i,
    /(?:give|bawa|ba|ga|for|to|from)\s+((?:Alhaji|Hajiya|Mallam|Mama|Chief|Mr|Mrs)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/i,
    /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,2})\s+(?:don\s+)?(?:transfer|pay|paid|ya\s+biya|biya|buy|collect)/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function findQuantityNearMatch(segment: string): number {
  const explicitQty = segment.match(/(?:qty\s*[:=]?\s*|x\s*)(\d+)/i);
  if (explicitQty) {
    return Math.max(1, parseInt(explicitQty[1], 10));
  }

  const leadingDigit = segment.match(/\b(\d{1,4})\s*(?:cartons?|ctns?|bags?|buhus?|trays?|crates?|kegs?|packs?|rolls?|pcs?|pieces?|katans?)?/i);
  if (leadingDigit) {
    const n = parseInt(leadingDigit[1], 10);
    if (n > 0 && n < 1000) return n;
  }

  const lower = segment.toLowerCase();
  for (const [word, num] of Object.entries(HAUSA_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      return num;
    }
  }
  for (const [word, num] of Object.entries(ENGLISH_NUMBERS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) {
      return num;
    }
  }
  return 1;
}

export function runOfflineEdgeParser(
  inputText: string,
  catalog: SkuItem[],
  knownCustomers: string[]
): ParsedPosPayload {
  const text = inputText.trim();
  const lower = text.toLowerCase();

  const isDebtPayment =
    /\b(old\s+debt|bashi|debt|balance\s+debt|clear\s+debt|owes|repay|repayment|ya\s+biya|biya\s+bashi)\b/i.test(
      lower
    ) &&
    !/\b(give|sell|siyar|sayar|carton|bag|buhu|tray|crate|keg|pack|indomie|rice|shinkafa|milk|sugar|oil)\b/i.test(
      lower
    );

  const isRestock =
    /\b(restock|offload|offloaded|supplier|distributor|stock\s+in|shigo\s+da|kara\s+kaya|delivery\s+slip)\b/i.test(
      lower
    );

  const isCredit =
    /\b(credit|bashi|pay\s+later|friday|monday|next\s+week|on\s+tab|go\s+balance|go\s+pay)\b/i.test(
      lower
    ) && !isDebtPayment;

  let action: PosAction = 'ADD_SALE';
  if (isDebtPayment) action = 'ADD_DEBTOR_PAYMENT';
  else if (isRestock) action = 'RESTOCK';
  else if (isCredit) action = 'ADD_CREDIT_SALE';

  let payment_method: PaymentMethod = 'CASH';
  if (action === 'ADD_CREDIT_SALE') {
    payment_method = 'CREDIT';
  } else if (
    /\b(transfer|opay|moniepoint|palmpay|kuda|bank|pos\s+transfer|alert)\b/i.test(
      lower
    )
  ) {
    payment_method = 'TRANSFER';
  } else if (/\bcredit\b/i.test(lower)) {
    payment_method = 'CREDIT';
  }

  const customer_name = extractCustomerName(text, knownCustomers);

  if (action === 'ADD_DEBTOR_PAYMENT') {
    const amountMatch = text.match(/(?:₦|NGN|N)?\s*(\d[\d,]*(?:\.\d+)?k?)/i);
    const amount = amountMatch ? parseNairaNumber(amountMatch[1]) : 0;
    return validatePosPayload({
      action: 'ADD_DEBTOR_PAYMENT',
      items: [
        {
          sku_id: 'DEBT-PAYMENT',
          name: 'Debtor Balance Repayment',
          quantity: 1,
          unit_price: amount,
        },
      ],
      customer_name,
      payment_method,
      notes: 'Parsed locally via offline edge rule engine',
    });
  }

  const segments = text
    .split(/(?:\band\b|\bda\b|\||,|;|\n)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const matchedItems: ParsedItem[] = [];
  const usedSkuIds = new Set<string>();

  for (const seg of segments) {
    const segLower = seg.toLowerCase();
    let bestSku: SkuItem | null = null;

    // 1. Direct barcode or SKU ID match
    for (const sku of catalog) {
      if (
        segLower.includes(sku.barcode.toLowerCase()) ||
        segLower.includes(sku.sku_id.toLowerCase())
      ) {
        bestSku = sku;
        break;
      }
    }

    // 2. Alias match (longest alias wins)
    if (!bestSku) {
      let longestMatch = 0;
      for (const sku of catalog) {
        for (const alias of sku.aliases) {
          if (segLower.includes(alias.toLowerCase()) && alias.length > longestMatch) {
            longestMatch = alias.length;
            bestSku = sku;
          }
        }
      }
    }

    if (bestSku && !usedSkuIds.has(bestSku.sku_id)) {
      usedSkuIds.add(bestSku.sku_id);
      const quantity = findQuantityNearMatch(seg);
      const priceMatch = seg.match(/@\s*(?:₦|NGN)?\s*(\d[\d,]*k?)/i);
      const parsedPrice = priceMatch
        ? parseNairaNumber(priceMatch[1])
        : action === 'RESTOCK'
          ? bestSku.cost_price
          : bestSku.unit_price;

      matchedItems.push({
        sku_id: bestSku.sku_id,
        name: bestSku.name,
        quantity,
        unit_price: parsedPrice,
      });
    }
  }

  // Fallback if segments didn't split cleanly (e.g. single sentence without separators)
  if (matchedItems.length === 0) {
    for (const sku of catalog) {
      const hit = sku.aliases.some((alias) => lower.includes(alias.toLowerCase()));
      if (hit) {
        matchedItems.push({
          sku_id: sku.sku_id,
          name: sku.name,
          quantity: findQuantityNearMatch(text),
          unit_price: action === 'RESTOCK' ? sku.cost_price : sku.unit_price,
        });
      }
    }
  }

  return validatePosPayload({
    action,
    items: matchedItems,
    customer_name,
    payment_method,
    notes: 'Parsed locally via offline edge rule engine',
  });
}

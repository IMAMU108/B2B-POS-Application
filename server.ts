import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const POS_SYSTEM_INSTRUCTION = `You are the Edge AI Parsing Engine for an offline-first B2B POS app used by Nigerian micro-merchants.
Your job is to convert messy merchant text, voice transcripts (which may contain English, Hausa, or Nigerian Pidgin), or barcode/camera OCR text/images into a strict, validated JSON object.

Never output conversational filler or Markdown text outside of the JSON block. Always output raw JSON matching the exact schema:
{
  "action": "ADD_SALE" | "ADD_CREDIT_SALE" | "RESTOCK" | "ADD_DEBTOR_PAYMENT",
  "items": [
    { "sku_id": string, "name": string, "quantity": number, "unit_price": number }
  ],
  "customer_name": string | null,
  "payment_method": "CASH" | "TRANSFER" | "CREDIT",
  "notes": string
}

Domain & Multilingual Rules:
1. Understand English, Hausa (e.g., "bawa/ba/sayar/siyar"=sell, "bashi"=credit/debt, "biya"=pay, "shinkafa"=rice, "sukari"=sugar, "madara"=milk, "mai"=oil, "gishiri"=salt, "buhu"=bag, "katan"=carton, "daya"=1, "biyu"=2, "uku"=3, "hudu"=4, "biyar"=5, "goma"=10), and Nigerian Pidgin (e.g., "abeg give", "on credit", "go balance Friday", "OPay/Moniepoint/PalmPay transfer", "k"=thousand like 15k=15000).
2. Match items to the provided Merchant SKU Catalog whenever possible using the exact sku_id, name, and unit_price (or cost_price when action is RESTOCK) unless the merchant specifies a different price (e.g. "@ 78000" or "6200 each").
3. If an item is not in the catalog, create a clean uppercase sku_id like "MANUAL-ITEM-NAME", keep the clear item name, and extract quantity and unit_price (0 if unknown).
4. For "ADD_CREDIT_SALE", always set "payment_method" to "CREDIT".
5. For "ADD_DEBTOR_PAYMENT" (customer paying down old debt/bashi), set "items" to a single entry: { "sku_id": "DEBT-PAYMENT", "name": "Debtor Balance Repayment", "quantity": 1, "unit_price": <repayment_amount_in_naira> }.
6. If customer is unnamed (such as walk-in cash sales or supplier restock without customer), set "customer_name" to null.
7. Keep "notes" concise and factual (e.g. promised repayment day, transfer bank/app, or OCR source).`;

const POS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: {
      type: Type.STRING,
      enum: ['ADD_SALE', 'ADD_CREDIT_SALE', 'RESTOCK', 'ADD_DEBTOR_PAYMENT'],
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sku_id: { type: Type.STRING },
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit_price: { type: Type.NUMBER },
        },
        required: ['sku_id', 'name', 'quantity', 'unit_price'],
      },
    },
    customer_name: {
      type: Type.STRING,
      nullable: true,
    },
    payment_method: {
      type: Type.STRING,
      enum: ['CASH', 'TRANSFER', 'CREDIT'],
    },
    notes: {
      type: Type.STRING,
    },
  },
  required: ['action', 'items', 'customer_name', 'payment_method', 'notes'],
};

interface CatalogContextItem {
  sku_id: string;
  barcode?: string;
  name: string;
  unit_price: number;
  cost_price?: number;
  aliases?: string[];
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(ai),
  });
});

app.post('/api/parse', async (req, res) => {
  const startedAt = Date.now();
  try {
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const {
      text = '',
      imageBase64,
      imageMimeType,
      audioBase64,
      audioMimeType,
      catalog = [],
      knownDebtors = [],
    } = req.body as {
      text?: string;
      imageBase64?: string;
      imageMimeType?: string;
      audioBase64?: string;
      audioMimeType?: string;
      catalog?: CatalogContextItem[];
      knownDebtors?: string[];
    };

    if (!text.trim() && !imageBase64 && !audioBase64) {
      return res.status(400).json({
        error: 'Provide merchant text, voice audio, or an OCR image to parse.',
      });
    }

    const catalogSummary = catalog
      .map(
        (c) =>
          `${c.sku_id} | barcode:${c.barcode ?? 'N/A'} | ${c.name} | sell:₦${c.unit_price} | cost:₦${c.cost_price ?? c.unit_price} | aliases:${(c.aliases ?? []).join(',')}`
      )
      .join('\n');

    const promptText = [
      'Merchant SKU Catalog:',
      catalogSummary || 'None provided',
      '',
      `Known Debtors: ${knownDebtors.length ? knownDebtors.join(', ') : 'None'}`,
      '',
      text.trim()
        ? `Merchant Input / Transcript / OCR Text:\n"""${text.trim()}"""`
        : 'Extract all transaction details from the attached media.',
    ].join('\n');

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64,
        },
      });
    }

    if (audioBase64 && audioMimeType) {
      parts.push({
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      });
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction: POS_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: POS_RESPONSE_SCHEMA,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      return res.status(502).json({
        error: 'Empty response received from Gemini parsing engine.',
      });
    }

    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const latency = Date.now() - startedAt;

    res.setHeader('X-Parser-Engine', 'gemini-4-hydrogen');
    res.setHeader('X-Parse-Latency-Ms', String(latency));
    return res.json(parsed);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected Edge AI parsing error.';
    return res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KasuwaPOS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

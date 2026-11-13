import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Copy,
  Mic,
  MicOff,
  Send,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { SAMPLE_PROMPTS } from '../data/seedCatalog';
import type {
  DebtorAccount,
  LedgerEntry,
  ParsedPosPayload,
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
  metrics,
  onCommit,
}: ParserWorkspaceProps) {
  const [modality, setModality] = useState<'TEXT' | 'VOICE' | 'OCR'>('TEXT');
  const [inputText, setInputText] = useState<string>(SAMPLE_PROMPTS[0].text);
  const [autoCommit, setAutoCommit] = useState<boolean>(false);

  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedPayload, setParsedPayload] = useState<ParsedPosPayload | null>(null);
  const [lastEngine, setLastEngine] = useState<'GEMINI_EDGE' | 'OFFLINE_EDGE' | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number>(0);
  const [committedTxnId, setCommittedTxnId] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Voice dictation & audio capture state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [audioData, setAudioData] = useState<{ base64: string; mimeType: string } | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // OCR / receipt image state
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const knownDebtors = debtors.map((d) => d.customer_name);

  async function handleParse(overrideText?: string) {
    const textToParse = (overrideText ?? inputText).trim();
    if (!textToParse && !imageData && !audioData) {
      setParseError('Enter merchant text, record voice audio, or attach an OCR receipt image.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setCommittedTxnId(null);

    const startedAt = performance.now();

    try {
      let validated: ParsedPosPayload;
      let engineUsed: 'GEMINI_EDGE' | 'OFFLINE_EDGE' = 'GEMINI_EDGE';
      let latencyMs = 0;

      if (isOffline) {
        if (!textToParse && (imageData || audioData)) {
          throw new Error(
            'Image/Audio multimodal parsing requires Online Edge mode. Switch to Online Edge or enter text/OCR string.'
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
              imageBase64: imageData?.base64,
              imageMimeType: imageData?.mimeType,
              audioBase64: audioData?.base64,
              audioMimeType: audioData?.mimeType,
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

          const rawBody = await response.json();
          if (!response.ok) {
            throw new Error(rawBody?.error || 'Edge AI request failed.');
          }

          validated = validatePosPayload(rawBody);
          const headerLatency = Number(response.headers.get('X-Parse-Latency-Ms'));
          latencyMs =
            Number.isFinite(headerLatency) && headerLatency > 0
              ? headerLatency
              : Math.round(performance.now() - startedAt);
        } catch (cloudErr) {
          // Graceful offline fallback if network dropped mid-request and text is available
          if (textToParse && !imageData && !audioData) {
            validated = runOfflineEdgeParser(textToParse, skus, knownDebtors);
            engineUsed = 'OFFLINE_EDGE';
            latencyMs = Math.max(5, Math.round(performance.now() - startedAt));
            setParseError(
              `Cloud parser unreachable (${cloudErr instanceof Error ? cloudErr.message : 'Network error'}). Parsed via Offline Edge fallback.`
            );
          } else {
            throw cloudErr;
          }
        }
      }

      setParsedPayload(validated);
      setLastEngine(engineUsed);
      setLastLatencyMs(latencyMs);

      if (autoCommit) {
        const entry = onCommit({
          payload: validated,
          rawInput:
            textToParse ||
            (imageData ? '[Receipt / Barcode Image OCR]' : '[Voice Audio Clip]'),
          modality,
          engine: engineUsed,
          latencyMs,
        });
        setCommittedTxnId(entry.id);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unable to parse input.');
    } finally {
      setIsParsing(false);
    }
  }

  function handleCommitParsed() {
    if (!parsedPayload || committedTxnId) return;
    const entry = onCommit({
      payload: parsedPayload,
      rawInput:
        inputText.trim() ||
        (imageData ? '[Receipt / Barcode Image OCR]' : '[Voice Audio Clip]'),
      modality,
      engine: lastEngine ?? 'GEMINI_EDGE',
      latencyMs: lastLatencyMs,
    });
    setCommittedTxnId(entry.id);
  }

  function handleCopyJson() {
    if (!parsedPayload) return;
    navigator.clipboard.writeText(JSON.stringify(parsedPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  }

  function toggleSpeechDictation() {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setParseError(
        'Browser speech recognition is unavailable here. Use "Record Audio Clip" or type transcript directly.'
      );
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
      setInputText(combined.trim());
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setParseError(`Microphone error: ${event.error}`);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  async function toggleAudioRecording() {
    if (isRecordingAudio) {
      mediaRecorderRef.current?.stop();
      setIsRecordingAudio(false);
      return;
    }

    try {
      setParseError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = String(reader.result ?? '');
          const base64 = result.split(',')[1] ?? '';
          setAudioData({ base64, mimeType });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
    } catch {
      setParseError('Microphone permission denied or unavailable.');
    }
  }

  function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? '');
      setImagePreviewUrl(dataUrl);
      const base64 = dataUrl.split(',')[1] ?? '';
      setImageData({
        base64,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.readAsDataURL(file);
  }

  const parsedTotal = parsedPayload ? computePayloadTotal(parsedPayload) : 0;

  return (
    <div className="space-y-6">
      {/* 4-column KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
          <p className="text-xs text-slate-500">Sales Settled (Cash / Transfer)</p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {formatNaira(metrics.cashAndTransferSales)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
          <p className="text-xs text-slate-500">Outstanding Debtors (Bashi)</p>
          <p className="mt-1 font-mono text-xl font-semibold text-amber-700 tabular-nums">
            {formatNaira(metrics.outstandingDebt)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
          <p className="text-xs text-slate-500">Low Stock Alerts</p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {metrics.lowStockCount} {metrics.lowStockCount === 1 ? 'SKU' : 'SKUs'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
          <p className="text-xs text-slate-500">Offline Sync Queue</p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {metrics.unsyncedCount === 0
              ? 'All Synced'
              : `${metrics.unsyncedCount} Queued`}
          </p>
        </div>
      </div>

      {/* Main Split: Input Console + Strict JSON Output */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left: Input Console */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Merchant Input Capture
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  English, Hausa, Nigerian Pidgin, voice transcripts, or barcode OCR
                </p>
              </div>

              <div
                className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
                role="tablist"
                aria-label="Input modality"
              >
                {(['TEXT', 'VOICE', 'OCR'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={modality === mode}
                    onClick={() => setModality(mode)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      modality === mode
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'TEXT'
                      ? 'Text'
                      : mode === 'VOICE'
                        ? 'Voice'
                        : 'Barcode / OCR'}
                  </button>
                ))}
              </div>
            </div>

            {/* Multilingual Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              {SAMPLE_PROMPTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    setModality(sample.modality);
                    setInputText(sample.text);
                    setAudioData(null);
                    setImageData(null);
                    setImagePreviewUrl(null);
                    setParseError(null);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            {/* Voice Capture Toolbar */}
            {modality === 'VOICE' && (
              <div className="flex flex-wrap items-center gap-2.5 py-2 border-y border-slate-100">
                <button
                  type="button"
                  onClick={toggleSpeechDictation}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isListening
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                  <span>{isListening ? 'Stop Dictation' : 'Live Transcript'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleAudioRecording}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isRecordingAudio
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isRecordingAudio ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isRecordingAudio ? 'Stop Audio Clip' : 'Record Audio Clip'}
                  </span>
                </button>

                {audioData && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700">
                    <span>Audio clip ready</span>
                    <button
                      type="button"
                      onClick={() => setAudioData(null)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="Remove recorded audio"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* OCR / Receipt Upload Toolbar */}
            {modality === 'OCR' && (
              <div className="flex flex-wrap items-center gap-3 py-2 border-y border-slate-100">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Receipt / Label Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Camera Scan</span>
                </button>
                {imagePreviewUrl && (
                  <div className="flex items-center gap-2">
                    <img
                      src={imagePreviewUrl}
                      alt="Uploaded receipt preview"
                      className="h-9 w-9 rounded object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreviewUrl(null);
                        setImageData(null);
                      }}
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="merchant-input" className="sr-only">
                Merchant message, voice transcript, or OCR text
              </label>
              <textarea
                id="merchant-input"
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or dictate a sale, credit entry, restock, or debtor payment in English, Hausa, or Nigerian Pidgin..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 resize-y"
              />
            </div>

            {parseError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCommit}
                onChange={(e) => setAutoCommit(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Auto-commit valid JSON to ledger</span>
            </label>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setParsedPayload(null);
                  setParseError(null);
                  setCommittedTxnId(null);
                  setImagePreviewUrl(null);
                  setImageData(null);
                  setAudioData(null);
                }}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleParse()}
                disabled={isParsing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isParsing ? 'Parsing...' : 'Parse to JSON'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Strict Validated JSON Output & Ledger Preview */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Validated JSON Output
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {parsedPayload
                  ? `${lastEngine === 'OFFLINE_EDGE' ? 'Offline Edge Rule Engine' : 'Gemini Edge Parser'} · ${lastLatencyMs} ms · Schema Valid`
                  : 'Strict TypeScript interface output'}
              </p>
            </div>

            {parsedPayload && (
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedJson ? (
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
              </button>
            )}
          </div>

          {!parsedPayload ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Ready to parse merchant input
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select a multilingual preset or enter a transaction message, then click
                Parse to JSON to inspect the validated payload and commit it to the
                offline-first ledger.
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              {/* Raw JSON Output Block */}
              <pre className="rounded-lg bg-slate-900 text-slate-100 p-3.5 font-mono text-xs leading-relaxed overflow-x-auto max-h-60">
                <code>{JSON.stringify(parsedPayload, null, 2)}</code>
              </pre>

              {/* Structured Ledger Impact Preview (flat hairline divider, no nested card) */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${getActionTextClass(parsedPayload.action)}`}>
                      {getActionLabel(parsedPayload.action)}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-700">
                      {parsedPayload.customer_name ?? 'Walk-in / Unspecified'}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-mono text-slate-600">
                      {parsedPayload.payment_method}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-sm text-slate-900 tabular-nums">
                    {formatNaira(parsedTotal)}
                  </span>
                </div>

                {parsedPayload.items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 text-left">
                          <th className="py-1.5 font-medium">SKU</th>
                          <th className="py-1.5 font-medium">Item</th>
                          <th className="py-1.5 font-medium text-right">Qty</th>
                          <th className="py-1.5 font-medium text-right">Unit</th>
                          <th className="py-1.5 font-medium text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPayload.items.map((item, idx) => (
                          <tr key={`${item.sku_id}-${idx}`}>
                            <td className="py-1.5 pr-2 font-mono text-slate-500 whitespace-nowrap">
                              {item.sku_id}
                            </td>
                            <td className="py-1.5 pr-2 text-slate-800">{item.name}</td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-slate-600">
                              {formatNaira(item.unit_price)}
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums font-medium text-slate-900">
                              {formatNaira(item.quantity * item.unit_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-500 truncate max-w-xs">
                    {parsedPayload.notes || 'No extra notes'}
                  </span>

                  {committedTxnId ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                      <span>
                        Committed as {committedTxnId}
                        {isOffline ? ' (Queued Offline)' : ''}
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCommitParsed}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Commit to Ledger</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Recent Activity Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Recent POS Ledger Activity
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            Showing latest {Math.min(5, ledger.length)} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-left">
                <th className="px-5 py-2.5 font-medium">Txn ID</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Payment</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                <th className="px-5 py-2.5 font-medium text-right">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.slice(0, 5).map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                    {entry.id}
                    <span className="text-slate-400 ml-2">
                      {formatShortDate(entry.created_at)}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 font-medium whitespace-nowrap ${getActionTextClass(entry.payload.action)}`}>
                    {getActionLabel(entry.payload.action)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    {entry.payload.customer_name ?? 'Walk-in'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                    {entry.payload.payment_method}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {entry.modality} · {entry.engine === 'GEMINI_EDGE' ? 'Cloud' : 'Local'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                    {formatNaira(entry.total_amount)}
                  </td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <span className={entry.synced ? 'text-emerald-700' : 'text-amber-700'}>
                      {entry.synced ? 'Synced' : 'Queued'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

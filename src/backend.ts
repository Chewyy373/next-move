// Next Move — backend (berjalan di worker Bun milik Lumiverse)
// Tugas: saat diminta frontend, ambil konteks chat -> minta LLM -> kirim balik daftar saran.

import { createInterest } from "./interest";

declare const spindle: any;

type Suggestion = { label: string; text: string };

const inflight = new Set<string>();

/* ---------- util ---------- */

function namesList(o: any): string[] {
  if (!o) return [];
  const names = new Set<string>();
  let p = o;
  while (p && p !== Object.prototype) {
    Object.getOwnPropertyNames(p).forEach((k) => names.add(k));
    p = Object.getPrototypeOf(p);
  }
  names.delete("constructor");
  return [...names];
}

function namesOf(o: any): string {
  if (!o) return "(tidak ada)";
  return namesList(o).join(", ") || "(kosong)";
}

function pickText(m: any): string {
  for (const k of ["content", "mes", "text", "message", "body"]) {
    const v = m?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v)) {
      const t = v.map((x: any) => (typeof x === "string" ? x : x?.text ?? "")).join("").trim();
      if (t) return t;
    }
  }
  return "";
}

function toList(raw: any): any[] {
  const l = Array.isArray(raw) ? raw : raw?.messages ?? raw?.items ?? raw?.data ?? [];
  return Array.isArray(l) ? l : [];
}

function describe(raw: any): string {
  if (Array.isArray(raw)) return `array ${raw.length}`;
  if (raw && typeof raw === "object") {
    const l = toList(raw);
    const k = l[0] ? ` item: ${Object.keys(l[0]).join("/")}` : "";
    return `object{${Object.keys(raw).join(",")}} data ${l.length}${k}`;
  }
  return typeof raw;
}

async function loadMessages(chatId: string, userId: string): Promise<{ role: string; content: string }[]> {
  // ADJUST: nama fungsi pembaca pesan dicari otomatis; fungsi yang mengubah data sengaja dilewati.
  const apis: [string, any][] = ([["chat", spindle.chat], ["chats", spindle.chats]] as [string, any][]).filter(([, a]) => a);
  const preferred = ["getMessages", "listMessages", "messages", "getChatMessages", "fetchMessages", "readMessages", "getHistory", "history"];
  const unsafe = /(create|add|append|insert|update|edit|delete|remove|clear|set|send|save|swipe|import|export|rename|start|stop)/i;
  const notes: string[] = [];

  for (const [apiName, api] of apis) {
    const all = namesList(api).filter((n) => typeof api[n] === "function");
    const found = all.filter((n) => /message|history/i.test(n) && !unsafe.test(n) && !/^on[A-Z]/.test(n));
    const candidates = [...preferred.filter((n) => all.includes(n)), ...found.filter((n) => !preferred.includes(n))];

    for (const fn of candidates) {
      const attempts = [
        () => api[fn](chatId, { userId }),
        () => api[fn](chatId),
        () => api[fn]({ chatId, userId }),
      ];
      for (const attempt of attempts) {
        try {
          const raw = await attempt();
          const out = toList(raw)
            .map((m) => ({ role: m?.role ?? (m?.is_user ? "user" : "assistant"), content: pickText(m) }))
            .filter((m) => m.content);
          if (out.length) return out;
          notes.push(`${apiName}.${fn}: ${describe(raw)}`);
        } catch (e: any) {
          notes.push(`${apiName}.${fn}: error ${e?.message ?? e}`);
        }
      }
    }
  }

  const msg =
    `Gagal membaca pesan chat. spindle.chat: [${namesOf(spindle.chat)}] | spindle.chats: [${namesOf(spindle.chats)}]` +
    (notes.length ? ` | percobaan: ${notes.slice(0, 6).join("; ")}` : "");
  console.error("[next-move]", msg);
  throw new Error(msg);
}

async function macro(text: string, chatId: string, userId: string, fallback: string) {
  try {
    const r = await spindle.macros.resolve(text, { chatId, userId });
    const out = typeof r === "string" ? r : r?.text ?? r?.content;
    return out && !out.includes("{{") ? out : fallback;
  } catch {
    return fallback;
  }
}

function parseSuggestions(text: string, max: number): Suggestion[] {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    return arr
      .filter((x: any) => x && typeof x.text === "string" && x.text.trim())
      .slice(0, max)
      .map((x: any) => ({
        label: String(x.label ?? "Aksi").slice(0, 24),
        text: String(x.text).trim(),
      }));
  } catch {
    return [];
  }
}

/* ---------- inti ---------- */

// Lumiverse tidak otomatis memakai koneksi chat untuk generate.raw, jadi koneksi dipilih di sini.
// ADJUST: nama field profil koneksi (active / is_default / id / provider / model) adalah tebakan terdekat.
async function resolveConnection(userId: string): Promise<any | null> {
  const api = spindle.connections;
  if (!api || typeof api.list !== "function") return null;
  let raw: any = null;
  const attempts = [() => api.list({ userId }), () => api.list(userId), () => api.list()];
  for (const attempt of attempts) {
    try {
      raw = await attempt();
      if (raw) break;
    } catch (e) {
      console.error("[next-move] connections.list gagal:", e);
    }
  }
  const list: any[] = Array.isArray(raw) ? raw : raw?.data ?? raw?.items ?? raw?.connections ?? [];
  if (!list.length) return null;
  const llm = list.filter((c) => !c?.kind || c.kind === "llm");
  const pool = llm.length ? llm : list;
  const isActive = (c: any) => c?.active || c?.is_active || c?.isActive || c?.is_default || c?.isDefault || c?.default;
  return pool.find(isActive) ?? pool[0];
}

async function suggest(chatId: string, userId: string, opts: any) {
  const count = Math.min(Math.max(Number(opts?.count) || 4, 2), 6);
  const pov = opts?.pov === "third" ? "third" : "first";
  const hint = String(opts?.hint ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

  const all = await loadMessages(chatId, userId);
  if (!all.length) throw new Error("Belum ada pesan di chat ini.");

  const userName = await macro("{{user}}", chatId, userId, "User");
  const charName = await macro("{{char}}", chatId, userId, "Karakter");

  const recent = all.slice(-8);
  const transcript = recent
    .map((m, i) => {
      const who = m.role === "user" ? userName : m.role === "assistant" ? charName : "Sistem";
      const limit = i === recent.length - 1 ? 3500 : 1200;
      return `[${who}]\n${m.content.slice(0, limit)}`;
    })
    .join("\n\n");

  const povRule =
    pov === "first"
      ? `Tulis dari sudut pandang orang pertama ("aku"/"saya"), seolah ${userName} sendiri yang mengetik.`
      : `Tulis dari sudut pandang orang ketiga memakai nama "${userName}".`;

  const variationRule = hint
    ? `- ARAHAN DARI PEMAIN: "${hint}". SEMUA opsi harus mengekspresikan arahan ini (nada, emosi, atau jenis tindakan yang diminta). Buat tepat ${count} opsi yang tetap BERBEDA satu sama lain dalam cara mengungkapkannya (misalnya: intensitas, ucapan vs tindakan fisik, terang-terangan vs tertahan).`
    : `- Buat tepat ${count} opsi yang BERBEDA arah (contoh: hati-hati, berani, bertanya, menyelidiki, santai/humor, emosional).`;

  const rel = await interest.summaryFor(chatId, userId).catch(() => "");
  const relRule = rel
    ? `- Kondisi hubungan saat ini (level minat 0-100): ${rel}. Saran harus masuk akal untuk tahap itu (jangan melompat, mis. ajakan romantis saat masih orang asing), tetapi satu opsi boleh mencoba mendekat selangkah.\n`
    : "";

  const system = `Kamu adalah asisten yang menyusun REKOMENDASI LANGKAH SELANJUTNYA untuk pemain dalam sebuah roleplay.
Pemain memerankan ${userName}. Lawan mainnya/narator adalah ${charName}.

Aturan:
${variationRule}
- Setiap opsi adalah SATU langkah ${userName}, 1-2 kalimat, maksimal 220 karakter.
- ${povRule}
- Gunakan gaya yang sama dengan chat: aksi/narasi diapit *tanda bintang*, dialog diapit "tanda kutip".
- Pakai bahasa yang sama dengan percakapan terakhir.
- JANGAN menulis reaksi atau ucapan ${charName}, dan jangan melompati waktu. Cukup langkah ${userName} saja.
- Konsisten dengan kepribadian, situasi, dan fakta yang sudah ada di chat.
${relRule}- Keluarkan HANYA JSON array, tanpa teks lain, dengan format:
[{"label":"1-2 kata","text":"isi langkah"}]`;

  const conn = await resolveConnection(userId);
  if (!conn) {
    throw new Error(
      `Tidak menemukan koneksi LLM. spindle.connections: [${namesOf(spindle.connections)}] | spindle.generate: [${namesOf(spindle.generate)}]`,
    );
  }

  let res: any;
  try {
    res = await spindle.generate.raw({
      userId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Berikut percakapan terbaru:\n\n${transcript}\n\nBuat ${count} rekomendasi langkah selanjutnya untuk ${userName}.${hint ? ` Arahan pemain: "${hint}".` : ""}` },
      ],
      parameters: { temperature: 0.95, max_tokens: 700 },
      connection_id: conn.id,
      ...(conn.provider ? { provider: conn.provider } : {}),
      ...(conn.model ? { model: conn.model } : {}),
    });
  } catch (e: any) {
    const label = conn.name ?? conn.id;
    console.error("[next-move] generate.raw gagal:", e);
    throw new Error(`Generate gagal (koneksi: ${label}, provider: ${conn.provider ?? "-"}, model: ${conn.model ?? "-"}): ${e?.message ?? e}`);
  }

  const content: string = typeof res === "string" ? res : res?.content ?? "";
  const items = parseSuggestions(content, count);
  if (!items.length) throw new Error("Model tidak mengembalikan format yang valid. Coba refresh.");
  return items;
}

async function callLLM(userId: string, messages: any[], parameters: any): Promise<string> {
  const conn = await resolveConnection(userId);
  if (!conn) throw new Error("Tidak menemukan koneksi LLM.");
  const res = await spindle.generate.raw({
    userId,
    messages,
    parameters,
    connection_id: conn.id,
    ...(conn.provider ? { provider: conn.provider } : {}),
    ...(conn.model ? { model: conn.model } : {}),
  });
  return typeof res === "string" ? res : res?.content ?? "";
}

const interest = createInterest({ llm: callLLM, macro });
const evalInflight = new Set<string>();

async function handleInterest(msg: any, userId: string) {
  const chatId: string = msg.chatId;
  const send = (p: any) => spindle.sendToFrontend({ chatId, ...p }, userId);
  const isEval = msg.type === "interest-eval";
  const key = `${userId}:${chatId}`;
  if (isEval) {
    if (evalInflight.has(key)) return;
    evalInflight.add(key);
  }
  try {
    let items: any[] = [];
    if (msg.type === "interest-get") {
      items = await interest.get(chatId, userId);
    } else if (isEval) {
      const all = await loadMessages(chatId, userId);
      const userName = await macro("{{user}}", chatId, userId, "User");
      const charName = await macro("{{char}}", chatId, userId, "Karakter");
      items = await interest.evaluate(chatId, userId, all, userName, charName, !!msg.force);
    } else if (msg.type === "interest-set") {
      items = await interest.adjust(chatId, userId, String(msg.name ?? ""), Math.max(-20, Math.min(20, Number(msg.delta) || 0)));
    } else if (msg.type === "interest-remove") {
      items = await interest.remove(chatId, userId, String(msg.name ?? ""));
    } else if (msg.type === "interest-reset") {
      items = await interest.reset(chatId, userId);
    } else {
      return;
    }
    send({ type: "interest", source: isEval ? "eval" : "other", items });
  } catch (e: any) {
    console.error("[next-move] interest gagal:", e);
    send({ type: "interest-error", source: isEval ? "eval" : "other", message: String(e?.message ?? e) });
  } finally {
    if (isEval) evalInflight.delete(key);
  }
}

/* ---------- IPC & event ---------- */

const queued = new Map<string, { msg: any; userId: string }>();

async function handleSuggest(msg: any, userId: string) {
  const key = `${userId}:${msg.chatId}`;
  if (inflight.has(key)) {
    queued.set(key, { msg, userId }); // permintaan terbaru menggantikan antrean sebelumnya
    return;
  }
  inflight.add(key);
  try {
    spindle.sendToFrontend({ type: "loading", chatId: msg.chatId }, userId);
    const items = await suggest(msg.chatId, userId, msg.options);
    spindle.sendToFrontend({ type: "suggestions", chatId: msg.chatId, items }, userId);
  } catch (e: any) {
    spindle.sendToFrontend({ type: "error", chatId: msg.chatId, message: String(e?.message ?? e) }, userId);
  } finally {
    inflight.delete(key);
    const next = queued.get(key);
    if (next) {
      queued.delete(key);
      void handleSuggest(next.msg, next.userId);
    }
  }
}

spindle.onFrontendMessage(async (msg: any, userId: string) => {
  if (!msg?.chatId || typeof msg.type !== "string") return;
  if (msg.type === "suggest") return handleSuggest(msg, userId);
  if (msg.type.startsWith("interest-")) return handleInterest(msg, userId);
});

// Setelah balasan AI selesai, beri tahu frontend (frontend yang memutuskan perlu auto-generate atau tidak).
spindle.on("GENERATION_ENDED", (payload: any) => {
  const userId = payload?.userId;
  const chatId = payload?.chatId;
  if (userId) spindle.sendToFrontend({ type: "generation-ended", chatId }, userId);
});

spindle.on("GENERATION_STARTED", (payload: any) => {
  const userId = payload?.userId;
  if (userId) spindle.sendToFrontend({ type: "generation-started" }, userId);
});

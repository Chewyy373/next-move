// Next Move — backend (berjalan di worker Bun milik Lumiverse)
// Tugas: saat diminta frontend, ambil konteks chat -> minta LLM -> kirim balik daftar saran.

declare const spindle: any;

type Suggestion = { label: string; text: string };

const inflight = new Set<string>();

/* ---------- util ---------- */

function namesOf(o: any): string {
  if (!o) return "(tidak ada)";
  const names = new Set<string>();
  let p = o;
  while (p && p !== Object.prototype) {
    Object.getOwnPropertyNames(p).forEach((k) => names.add(k));
    p = Object.getPrototypeOf(p);
  }
  names.delete("constructor");
  return [...names].join(", ") || "(kosong)";
}

async function loadMessages(chatId: string, userId: string): Promise<{ role: string; content: string }[]> {
  // ADJUST: nama fungsi bisa sedikit beda antar versi Lumiverse.
  const apis: [string, any][] = ([["chat", spindle.chat], ["chats", spindle.chats]] as [string, any][]).filter(([, a]) => a);
  const fnNames = ["getMessages", "listMessages", "messages", "getChatMessages", "list", "get"];
  const notes: string[] = [];
  let raw: any = null;

  for (const [apiName, api] of apis) {
    for (const fn of fnNames) {
      if (typeof api[fn] !== "function") continue;
      const attempts = [
        () => api[fn](chatId, { userId }),
        () => api[fn](chatId),
        () => api[fn]({ chatId, userId }),
      ];
      for (const attempt of attempts) {
        try {
          const r = await attempt();
          if (r) {
            raw = r;
            break;
          }
        } catch (e: any) {
          notes.push(`${apiName}.${fn}: ${e?.message ?? e}`);
        }
      }
      if (raw) break;
    }
    if (raw) break;
  }

  if (!raw) {
    const msg =
      `Gagal membaca pesan chat. spindle: [${namesOf(spindle)}] | spindle.chat: [${namesOf(spindle.chat)}] | spindle.chats: [${namesOf(spindle.chats)}]` +
      (notes.length ? ` | error: ${notes.slice(0, 3).join("; ")}` : "");
    console.error("[next-move]", msg);
    throw new Error(msg);
  }

  const list: any[] = Array.isArray(raw) ? raw : raw?.messages ?? raw?.items ?? raw?.data ?? [];

  const pickText = (m: any): string => {
    for (const k of ["content", "mes", "text", "message", "body"]) {
      const v = m?.[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (Array.isArray(v)) {
        const t = v.map((x: any) => (typeof x === "string" ? x : x?.text ?? "")).join("").trim();
        if (t) return t;
      }
    }
    return "";
  };

  const out = (Array.isArray(list) ? list : [])
    .map((m) => ({
      role: m?.role ?? (m?.is_user ? "user" : "assistant"),
      content: pickText(m),
    }))
    .filter((m) => m.content);

  if (!out.length) {
    const first = Array.isArray(list) && list[0] ? list[0] : null;
    const detail =
      `data: ${Array.isArray(list) ? "array panjang " + list.length : typeof list}` +
      `, total: ${raw?.total ?? "-"}` +
      (first
        ? `, kunci pesan pertama: ${Object.keys(first).join(", ")}, tipe content: ${typeof first.content}`
        : "");
    console.error("[next-move] pesan kosong:", detail);
    throw new Error(`Pesan terbaca tapi kosong. ${detail}`);
  }
  return out;
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

async function suggest(chatId: string, userId: string, opts: any) {
  const count = Math.min(Math.max(Number(opts?.count) || 4, 2), 6);
  const pov = opts?.pov === "third" ? "third" : "first";

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

  const system = `Kamu adalah asisten yang menyusun REKOMENDASI LANGKAH SELANJUTNYA untuk pemain dalam sebuah roleplay.
Pemain memerankan ${userName}. Lawan mainnya/narator adalah ${charName}.

Aturan:
- Buat tepat ${count} opsi yang BERBEDA arah (contoh: hati-hati, berani, bertanya, menyelidiki, santai/humor, emosional).
- Setiap opsi adalah SATU langkah ${userName}, 1-2 kalimat, maksimal 220 karakter.
- ${povRule}
- Gunakan gaya yang sama dengan chat: aksi/narasi diapit *tanda bintang*, dialog diapit "tanda kutip".
- Pakai bahasa yang sama dengan percakapan terakhir.
- JANGAN menulis reaksi atau ucapan ${charName}, dan jangan melompati waktu. Cukup langkah ${userName} saja.
- Konsisten dengan kepribadian, situasi, dan fakta yang sudah ada di chat.
- Keluarkan HANYA JSON array, tanpa teks lain, dengan format:
[{"label":"1-2 kata","text":"isi langkah"}]`;

  const res = await spindle.generate.raw({
    userId,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Berikut percakapan terbaru:\n\n${transcript}\n\nBuat ${count} rekomendasi langkah selanjutnya untuk ${userName}.` },
    ],
    parameters: { temperature: 0.95, max_tokens: 700 },
    // ADJUST: jika ingin pakai koneksi/model tertentu, tambahkan connection id di sini.
  });

  const content: string = typeof res === "string" ? res : res?.content ?? "";
  const items = parseSuggestions(content, count);
  if (!items.length) throw new Error("Model tidak mengembalikan format yang valid. Coba refresh.");
  return items;
}

/* ---------- IPC & event ---------- */

spindle.onFrontendMessage(async (msg: any, userId: string) => {
  if (msg?.type !== "suggest" || !msg.chatId) return;
  const key = `${userId}:${msg.chatId}`;
  if (inflight.has(key)) return;
  inflight.add(key);
  try {
    spindle.sendToFrontend({ type: "loading", chatId: msg.chatId }, userId);
    const items = await suggest(msg.chatId, userId, msg.options);
    spindle.sendToFrontend({ type: "suggestions", chatId: msg.chatId, items }, userId);
  } catch (e: any) {
    spindle.sendToFrontend({ type: "error", chatId: msg.chatId, message: String(e?.message ?? e) }, userId);
  } finally {
    inflight.delete(key);
  }
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

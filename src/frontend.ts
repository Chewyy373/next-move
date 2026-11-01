// Next Move — frontend (berjalan di browser)
// Menampilkan panel tombol saran di atas kotak input, lalu mengirimkan pilihan sebagai pesan {{user}}.

/* ===== Pengaturan yang mungkin perlu kamu sesuaikan ===== */
const SEND_BUTTON_SELECTOR = ""; // isi mis. 'button[aria-label="Send"]' jika auto-kirim salah tombol
const ACCENT = "#9d7cf0"; // ungu default Lumiverse; ganti kalau temamu beda
const KEEP_HINT_AFTER_USE = false; // false: kolom arahan dikosongkan setelah kamu memilih saran; true: arahan tetap dipakai

const STORE_KEY = "next-move:settings";
const defaults = { count: 4, autoSend: true, autoGenerate: true, pov: "first", collapsed: false, interestOn: true };
type Settings = typeof defaults;

const CSS = `
.nm-panel{position:fixed;z-index:50;display:none;flex-direction:column;gap:8px;box-sizing:border-box;
  max-height:46vh;overflow-y:auto;overscroll-behavior:contain;padding:10px;border-radius:18px;
  background:color-mix(in srgb, #14111f 88%, transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid color-mix(in srgb, ${ACCENT} 28%, transparent);
  box-shadow:0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
  font-family:inherit;color:inherit;animation:nm-in .22s ease-out}
.nm-panel.nm-show{display:flex}
@keyframes nm-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.nm-head{display:flex;align-items:center;gap:8px;font-size:13px;letter-spacing:.02em}
.nm-title{display:flex;align-items:center;gap:6px;flex:1;color:${ACCENT};font-weight:600}
.nm-title svg{width:16px;height:16px}
.nm-ibtn{all:unset;box-sizing:border-box;display:grid;place-items:center;width:30px;height:30px;border-radius:10px;
  cursor:pointer;color:#cfc6ee;opacity:.8;transition:.15s;border:1px solid transparent}
.nm-ibtn:hover{background:color-mix(in srgb, ${ACCENT} 16%, transparent);opacity:1}
.nm-ibtn.nm-on{color:${ACCENT};border-color:color-mix(in srgb, ${ACCENT} 45%, transparent);background:color-mix(in srgb, ${ACCENT} 14%, transparent);opacity:1}
.nm-ibtn svg{width:16px;height:16px}
.nm-ibtn.nm-spin svg{animation:nm-rot .8s linear infinite}
@keyframes nm-rot{to{transform:rotate(360deg)}}
.nm-list{display:flex;flex-direction:column;gap:7px;overflow-y:auto;overscroll-behavior:contain;padding-right:2px}
.nm-card{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:14px;cursor:pointer;
  background:color-mix(in srgb, #ffffff 4%, transparent);border:1px solid color-mix(in srgb, ${ACCENT} 20%, transparent);
  transition:transform .12s, background .15s, border-color .15s;-webkit-tap-highlight-color:transparent}
.nm-card:hover{background:color-mix(in srgb, ${ACCENT} 14%, transparent);border-color:color-mix(in srgb, ${ACCENT} 55%, transparent)}
.nm-card:active{transform:scale(.985)}
.nm-tag{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:${ACCENT};font-weight:700}
.nm-text{font-size:14px;line-height:1.45;color:#e7e2f7;font-style:italic;white-space:pre-wrap}
.nm-skel{height:58px;border-radius:14px;border:1px solid color-mix(in srgb, ${ACCENT} 14%, transparent);
  background:linear-gradient(100deg,transparent 30%,color-mix(in srgb, ${ACCENT} 14%, transparent) 50%,transparent 70%) #ffffff08;
  background-size:200% 100%;animation:nm-sh 1.3s linear infinite}
@keyframes nm-sh{from{background-position:200% 0}to{background-position:-200% 0}}
.nm-msg{font-size:13px;opacity:.75;padding:6px 4px}
.nm-fab{all:unset;box-sizing:border-box;position:fixed;z-index:50;display:none;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;
  cursor:pointer;font-size:13px;color:${ACCENT};font-family:inherit;
  background:color-mix(in srgb, #14111f 88%, transparent);backdrop-filter:blur(12px);border:1px solid color-mix(in srgb, ${ACCENT} 35%, transparent)}
.nm-fab.nm-show{display:inline-flex}
.nm-fab svg{width:15px;height:15px}
.nm-ask{display:flex;align-items:center;gap:6px}
.nm-input{flex:1;min-width:0;box-sizing:border-box;height:34px;padding:0 12px;border-radius:12px;
  background:color-mix(in srgb, #ffffff 5%, transparent);border:1px solid color-mix(in srgb, ${ACCENT} 25%, transparent);
  color:#e7e2f7;font:inherit;font-size:14px;outline:none;transition:border-color .15s}
.nm-input:focus{border-color:color-mix(in srgb, ${ACCENT} 60%, transparent)}
.nm-input::placeholder{color:#e7e2f7;opacity:.4}
@media (pointer:coarse){.nm-input{font-size:16px}}
.nm-int{display:flex;flex-direction:column;gap:6px}
.nm-inthead{display:flex;align-items:center;gap:6px;font-size:12px;color:${ACCENT};font-weight:600;letter-spacing:.03em}
.nm-sp{flex:1}
.nm-mini{all:unset;box-sizing:border-box;font-size:11.5px;padding:3px 10px;border-radius:999px;cursor:pointer;color:#cfc6ee;
  border:1px solid color-mix(in srgb, ${ACCENT} 25%, transparent);-webkit-tap-highlight-color:transparent}
.nm-mini:hover{background:color-mix(in srgb, ${ACCENT} 16%, transparent)}
.nm-ch{border-radius:14px;padding:8px 10px;background:color-mix(in srgb, #ffffff 4%, transparent);border:1px solid color-mix(in srgb, ${ACCENT} 18%, transparent)}
.nm-away{opacity:.62}
.nm-chtop{all:unset;box-sizing:border-box;display:grid;grid-template-columns:1fr auto auto;align-items:baseline;gap:4px 8px;width:100%;cursor:pointer}
.nm-chn{font-size:14px;font-weight:600;color:#ece8fb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nm-chs{font-size:13px;font-variant-numeric:tabular-nums;color:#e7e2f7}
.nm-chd{font-size:11.5px;min-width:44px;text-align:right;font-variant-numeric:tabular-nums}
.nm-up{color:#7ddc9b}.nm-dn{color:#f08a8a}
.nm-bar{position:relative;height:7px;border-radius:99px;background:color-mix(in srgb, #ffffff 8%, transparent);margin-top:7px}
.nm-fill{height:100%;border-radius:99px;background:linear-gradient(90deg, ${ACCENT}, #f27ab8);transition:width .5s ease}
.nm-tick{position:absolute;left:80%;top:-3px;width:2px;height:13px;border-radius:2px;background:color-mix(in srgb, #ffffff 35%, transparent)}
.nm-stage{font-size:11.5px;opacity:.75;margin-top:5px}
.nm-det{margin-top:8px;display:flex;flex-direction:column;gap:6px;font-size:12.5px;line-height:1.45;color:#ddd7f3}
.nm-chips{display:flex;flex-wrap:wrap;gap:5px}
.nm-chip{font-size:11px;padding:2px 8px;border-radius:99px;background:color-mix(in srgb, ${ACCENT} 14%, transparent)}
.nm-acts{display:flex;gap:6px;flex-wrap:wrap}
.nm-why{opacity:.85}
`;

const ICON = {
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
};

export function setup(ctx: any) {
  /* ---------- state ---------- */
  let settings: Settings = { ...defaults };
  try {
    settings = { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {}
  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch {}
  };

  let items: { label: string; text: string }[] = [];
  let status: "idle" | "loading" | "error" | "generating" = "idle";
  let errorMsg = "";
  let lastSig = "";
  type IView = { name: string; score: number; delta: number; present: boolean; stage: { label: string; desc: string }; reasons: { d: number; t: string }[]; likes: string[]; dislikes: string[]; values: string[] };
  let view: IView[] = [];
  let expanded: string | null = null;
  let intNote = "";
  let lastIntSig = "";
  let loadedFor = "";
  let loadingSince = 0;

  /* ---------- DOM ---------- */
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "nm-panel";
  // Kerangka panel dibuat SEKALI supaya teks di kolom arahan tidak hilang saat panel diperbarui.
  panel.innerHTML = `
    <div class="nm-head">
      <div class="nm-title">${ICON.spark}<span>Langkah selanjutnya</span></div>
      <button class="nm-ibtn" data-a="auto">${ICON.bolt}</button>
      <button class="nm-ibtn" data-a="heart">${ICON.heart}</button>
      <button class="nm-ibtn" data-a="refresh" title="Buat ulang saran">${ICON.refresh}</button>
      <button class="nm-ibtn" data-a="collapse" title="Sembunyikan">${ICON.down}</button>
    </div>
    <div class="nm-ask">
      <input class="nm-input" type="text" maxlength="120" autocomplete="off" spellcheck="false" placeholder="Arahkan saran… mis. marah, menggoda, curiga" />
      <button class="nm-ibtn" data-a="go" title="Buat saran sesuai arahan">${ICON.send}</button>
    </div>
    <div class="nm-int"></div>
    <div class="nm-list"></div>`;
  const input = panel.querySelector(".nm-input") as HTMLInputElement;
  const listEl = panel.querySelector(".nm-list") as HTMLElement;
  const autoBtn = panel.querySelector('[data-a="auto"]') as HTMLElement;
  const refreshBtn = panel.querySelector('[data-a="refresh"]') as HTMLElement;
  const heartBtn = panel.querySelector('[data-a="heart"]') as HTMLElement;
  const intEl = panel.querySelector(".nm-int") as HTMLElement;
  const fab = document.createElement("button");
  fab.className = "nm-fab";
  fab.innerHTML = `${ICON.spark}<span>Langkah selanjutnya</span>`;
  document.body.append(panel, fab);

  fab.onclick = () => {
    settings.collapsed = false;
    save();
    if (!items.length && status === "idle") request();
    render();
  };

  /* ---------- helpers ---------- */
  const getChatId = () => location.pathname.match(/\/chat\/([0-9a-f-]{8,})/i)?.[1] || null;

  function findTextarea(): HTMLTextAreaElement | null {
    const all = Array.from(document.querySelectorAll("textarea")) as HTMLTextAreaElement[];
    const visible = all.filter((t) => t.offsetParent !== null && t.getBoundingClientRect().width > 80);
    return visible[visible.length - 1] || null;
  }

  // Cari "kartu input" (pembungkus textarea + toolbar) agar panel sejajar dengannya.
  function findInputBox(ta: HTMLElement): HTMLElement {
    let el: HTMLElement = ta;
    while (el.parentElement && el.parentElement !== document.body) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.height > 240 || r.width > window.innerWidth + 1) break;
      el = el.parentElement;
    }
    return el;
  }

  function setNativeValue(el: HTMLTextAreaElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function clickSend(box: HTMLElement, ta: HTMLTextAreaElement) {
    let btn: HTMLButtonElement | null = null;
    if (SEND_BUTTON_SELECTOR) btn = document.querySelector(SEND_BUTTON_SELECTOR);
    if (!btn) {
      const buttons = Array.from(box.querySelectorAll("button")) as HTMLButtonElement[];
      btn =
        buttons.find((b) => b.type === "submit") ||
        buttons.find((b) => /send|kirim/i.test(`${b.getAttribute("aria-label")} ${b.title} ${b.dataset.action ?? ""}`)) ||
        null;
    }
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    // Cadangan: simulasi Enter
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  }

  function useSuggestion(text: string) {
    const ta = findTextarea();
    if (!ta) return;
    const box = findInputBox(ta);
    setNativeValue(ta, text);
    ta.focus();
    if (!KEEP_HINT_AFTER_USE) input.value = "";
    if (settings.autoSend) {
      setTimeout(() => {
        clickSend(box, ta);
        items = [];
        status = "generating";
        render();
      }, 90);
    }
  }

  function request() {
    const chatId = getChatId();
    if (!chatId) return;
    status = "loading";
    loadingSince = Date.now();
    render();
    ctx.sendToBackend({
      type: "suggest",
      chatId,
      options: { count: settings.count, pov: settings.pov, hint: input.value.trim() },
    });
  }

  /* ---------- render ---------- */
  function render(force = false) {
    const hasChat = !!getChatId() && !!findTextarea();
    fab.classList.toggle("nm-show", hasChat && settings.collapsed);
    panel.classList.toggle("nm-show", hasChat && !settings.collapsed);
    if (!hasChat || settings.collapsed) return;

    autoBtn.classList.toggle("nm-on", settings.autoSend);
    autoBtn.title = settings.autoSend ? "Auto-kirim: aktif" : "Auto-kirim: mati (hanya isi kotak input)";
    refreshBtn.classList.toggle("nm-spin", status === "loading");
    renderInterest(force);

    // Daftar saran hanya dibangun ulang kalau isinya berubah (bukan tiap tick).
    const sig = `${status}|${errorMsg}|${settings.count}|${items.map((i) => i.text).join("¦")}`;
    if (force || sig !== lastSig) {
      lastSig = sig;
      listEl.innerHTML = "";
      if (status === "loading") {
        for (let i = 0; i < Math.min(settings.count, 4); i++) listEl.insertAdjacentHTML("beforeend", `<div class="nm-skel"></div>`);
      } else if (status === "generating") {
        listEl.innerHTML = `<div class="nm-msg">Menunggu balasan… saran baru akan muncul otomatis.</div>`;
      } else if (status === "error") {
        const m = document.createElement("div");
        m.className = "nm-msg";
        m.textContent = errorMsg || "Gagal membuat saran.";
        listEl.appendChild(m);
      } else if (!items.length) {
        listEl.innerHTML = `<div class="nm-msg">Ketik arahan lalu Enter, atau tekan ↻ untuk saran bebas.</div>`;
      } else {
        items.forEach((it) => {
          const b = document.createElement("button");
          b.className = "nm-card";
          const tag = document.createElement("span");
          tag.className = "nm-tag";
          tag.textContent = it.label;
          const txt = document.createElement("span");
          txt.className = "nm-text";
          txt.textContent = it.text;
          b.append(tag, txt);
          b.onclick = () => useSuggestion(it.text);
          listEl.appendChild(b);
        });
      }
    }
    position();
  }

  /* ---------- level minat ---------- */
  function h(tag: string, cls = "", text = ""): HTMLElement {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function act(e: HTMLElement, a: string, n?: string): HTMLElement {
    e.dataset.a = a;
    if (n !== undefined) e.dataset.n = n;
    return e;
  }
  function sendInterest(payload: any) {
    const chatId = getChatId();
    if (chatId) ctx.sendToBackend({ chatId, ...payload });
  }
  function ensureInterestLoaded(force = false) {
    const c = getChatId();
    if (!c || !settings.interestOn) return;
    if (!force && loadedFor === c) return;
    loadedFor = c;
    ctx.sendToBackend({ type: "interest-get", chatId: c });
  }
  function buildBlock(): string {
    const lines = view.filter((v) => v.present).map((v) => `- ${v.name}: ${v.score}/100 (${v.stage.label}) — ${v.stage.desc}`);
    return `[Level minat karakter terhadap pemain (skala 0-100). Ini kecenderungan sikap, bukan perintah; bereaksilah sesuai kepribadian masing-masing dan jangan melompati tahap hubungan.\n${lines.join("\n")}]`;
  }
  function copyText(t: string) {
    const done = (ok: boolean) => {
      intNote = ok ? "Disalin. Tempel ke Author's Note jika ingin dipakai di prompt." : "Gagal menyalin.";
      renderInterest(true);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).then(() => done(true), () => done(false));
      return;
    }
    // Lumiverse lewat http://192.168.x.x bukan secure context, jadi pakai cara lama.
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    done(ok);
  }

  function renderInterest(force = false) {
    heartBtn.classList.toggle("nm-on", settings.interestOn);
    heartBtn.title = settings.interestOn ? "Level minat: aktif" : "Level minat: mati";
    intEl.style.display = settings.interestOn ? "" : "none";
    if (!settings.interestOn) return;
    const sig = JSON.stringify([view, expanded, intNote]);
    if (!force && sig === lastIntSig) return;
    lastIntSig = sig;
    intEl.innerHTML = "";

    const head = h("div", "nm-inthead");
    head.append(h("span", "", "♡ Level minat"), h("span", "nm-sp"));
    if (view.length) {
      head.append(act(h("button", "nm-mini", "Salin"), "i-copy"), act(h("button", "nm-mini", "Reset"), "i-reset"));
    } else {
      head.append(act(h("button", "nm-mini", "Nilai sekarang"), "i-eval"));
    }
    intEl.appendChild(head);
    if (intNote) intEl.appendChild(h("div", "nm-msg", intNote));
    if (!view.length && !intNote) intEl.appendChild(h("div", "nm-msg", "Belum ada data. Level minat dinilai otomatis setelah balasan berikutnya."));

    for (const v of view) {
      const row = h("div", "nm-ch" + (v.present ? "" : " nm-away"));
      const top = act(h("button", "nm-chtop"), "i-open", v.name);
      const d = h("span", "nm-chd" + (v.delta > 0 ? " nm-up" : v.delta < 0 ? " nm-dn" : ""), v.delta > 0 ? `▲ +${v.delta}` : v.delta < 0 ? `▼ ${v.delta}` : "");
      top.append(h("span", "nm-chn", v.name), h("span", "nm-chs", `${v.score}/100`), d);
      const bar = h("div", "nm-bar");
      const fill = h("div", "nm-fill");
      fill.style.width = `${v.score}%`;
      bar.append(fill, h("div", "nm-tick"));
      row.append(top, bar, h("div", "nm-stage", v.stage.label + (v.present ? "" : " · tidak di tempat")));

      if (expanded === v.name) {
        const det = h("div", "nm-det");
        det.appendChild(h("div", "", v.stage.desc));
        v.reasons.forEach((r) => det.appendChild(h("div", "nm-why", `${r.d > 0 ? "+" : ""}${r.d}  ${r.t}`)));
        const chips = h("div", "nm-chips");
        v.likes.forEach((x) => chips.appendChild(h("span", "nm-chip", `♥ ${x}`)));
        v.dislikes.forEach((x) => chips.appendChild(h("span", "nm-chip", `✕ ${x}`)));
        v.values.forEach((x) => chips.appendChild(h("span", "nm-chip", `◆ ${x}`)));
        if (chips.childNodes.length) det.appendChild(chips);
        const acts = h("div", "nm-acts");
        acts.append(
          act(h("button", "nm-mini", "−5"), "i-minus", v.name),
          act(h("button", "nm-mini", "+5"), "i-plus", v.name),
          act(h("button", "nm-mini", "Hapus"), "i-del", v.name),
        );
        det.appendChild(acts);
        row.appendChild(det);
      }
      intEl.appendChild(row);
    }
  }

  /* ---------- aksi tombol & kolom arahan ---------- */
  panel.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
    if (!el) return;
    const a = el.dataset.a;
    const n = el.dataset.n || "";
    if (a === "auto") {
      settings.autoSend = !settings.autoSend;
      save();
      render(true);
    } else if (a === "collapse") {
      settings.collapsed = true;
      save();
      render(true);
    } else if (a === "refresh" || a === "go") {
      request();
    } else if (a === "heart") {
      settings.interestOn = !settings.interestOn;
      save();
      if (settings.interestOn) ensureInterestLoaded(true);
      render(true);
    } else if (a === "i-open") {
      expanded = expanded === n ? null : n;
      renderInterest(true);
    } else if (a === "i-plus" || a === "i-minus") {
      sendInterest({ type: "interest-set", name: n, delta: a === "i-plus" ? 5 : -5 });
    } else if (a === "i-del") {
      sendInterest({ type: "interest-remove", name: n });
    } else if (a === "i-reset") {
      if (confirm("Reset semua level minat di chat ini?")) sendInterest({ type: "interest-reset" });
    } else if (a === "i-copy") {
      copyText(buildBlock());
    } else if (a === "i-eval") {
      intNote = "";
      sendInterest({ type: "interest-eval", force: true });
    }
  });
  // Ketikan di kolom arahan tidak boleh bocor ke shortcut keyboard milik Lumiverse.
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      request();
    }
  });
  input.addEventListener("keyup", (e) => e.stopPropagation());
  input.addEventListener("keypress", (e) => e.stopPropagation());

  function position() {
    const ta = findTextarea();
    if (!ta) return;
    const r = findInputBox(ta).getBoundingClientRect();
    const bottom = window.innerHeight - r.top + 8;
    panel.style.left = `${Math.max(r.left, 6)}px`;
    panel.style.width = `${Math.min(r.width, window.innerWidth - 12)}px`;
    panel.style.bottom = `${bottom}px`;
    fab.style.left = `${Math.max(r.left, 6) + 4}px`;
    fab.style.bottom = `${bottom}px`;
  }

  /* ---------- pesan dari backend ---------- */
  const onMsg = (msg: any) => {
    if (!msg) return;
    const chatId = getChatId();
    if (msg.chatId && chatId && msg.chatId !== chatId) return;

    if (msg.type === "interest") {
      view = msg.items || [];
      intNote = "";
      if (expanded && !view.some((v) => v.name === expanded)) expanded = null;
      if (msg.source === "eval") {
        status = "idle";
        if (settings.autoGenerate) request();
        else render(true);
      } else {
        renderInterest(true);
      }
      return;
    }
    if (msg.type === "interest-error") {
      intNote = `Gagal menilai minat: ${String(msg.message || "").slice(0, 160)}`;
      if (msg.source === "eval") {
        status = "idle";
        if (settings.autoGenerate) request();
        else render(true);
      } else {
        renderInterest(true);
      }
      return;
    }
    if (msg.type === "generation-started") {
      status = "generating";
      items = [];
      render();
    } else if (msg.type === "generation-ended") {
      status = "idle";
      if (settings.interestOn) {
        status = "loading";
        loadingSince = Date.now();
        render();
        sendInterest({ type: "interest-eval" }); // saran dibuat setelah penilaian selesai
      } else if (settings.autoGenerate) request();
      else render();
    } else if (msg.type === "loading") {
      status = "loading";
      render();
    } else if (msg.type === "suggestions") {
      items = msg.items || [];
      status = "idle";
      render();
    } else if (msg.type === "error") {
      status = "error";
      errorMsg = msg.message || "";
      render();
    }
  };
  const unsub = ctx.onBackendMessage(onMsg);

  /* ---------- reposisi & deteksi navigasi ---------- */
  let lastUrl = location.href;
  const tick = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      items = [];
      status = "idle";
      view = [];
      expanded = null;
      intNote = "";
    }
    if (status === "loading" && Date.now() - loadingSince > 90000) status = "idle"; // jaga-jaga kalau balasan backend hilang
    ensureInterestLoaded();
    render();
  };
  const timer = window.setInterval(tick, 700);
  const onResize = () => position();
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("scroll", onResize);
  render();

  /* ---------- cleanup ---------- */
  return () => {
    clearInterval(timer);
    window.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("scroll", onResize);
    if (typeof unsub === "function") unsub();
    panel.remove();
    fab.remove();
    style.remove();
  };
}

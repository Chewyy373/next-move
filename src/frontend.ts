// Next Move — frontend (berjalan di browser)
// Menampilkan panel tombol saran di atas kotak input, lalu mengirimkan pilihan sebagai pesan {{user}}.

/* ===== Pengaturan yang mungkin perlu kamu sesuaikan ===== */
const SEND_BUTTON_SELECTOR = ""; // isi mis. 'button[aria-label="Send"]' jika auto-kirim salah tombol
const ACCENT = "#9d7cf0"; // ungu default Lumiverse; ganti kalau temamu beda

const STORE_KEY = "next-move:settings";
const defaults = { count: 4, autoSend: true, autoGenerate: true, pov: "first", collapsed: false };
type Settings = typeof defaults;

const CSS = `
.nm-panel{position:fixed;z-index:50;display:none;flex-direction:column;gap:8px;box-sizing:border-box;
  max-height:42vh;padding:10px;border-radius:18px;
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
`;

const ICON = {
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>`,
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

  /* ---------- DOM ---------- */
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "nm-panel";
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
    render();
    ctx.sendToBackend({
      type: "suggest",
      chatId,
      options: { count: settings.count, pov: settings.pov },
    });
  }

  /* ---------- render ---------- */
  function render() {
    const hasChat = !!getChatId() && !!findTextarea();
    fab.classList.toggle("nm-show", hasChat && settings.collapsed);
    panel.classList.toggle("nm-show", hasChat && !settings.collapsed);
    if (!hasChat || settings.collapsed) return;

    const spin = status === "loading" ? " nm-spin" : "";
    panel.innerHTML = `
      <div class="nm-head">
        <div class="nm-title">${ICON.spark}<span>Langkah selanjutnya</span></div>
        <button class="nm-ibtn ${settings.autoSend ? "nm-on" : ""}" data-a="auto" title="${settings.autoSend ? "Auto-kirim: aktif" : "Auto-kirim: mati (hanya isi kotak input)"}">${ICON.bolt}</button>
        <button class="nm-ibtn${spin}" data-a="refresh" title="Buat ulang saran">${ICON.refresh}</button>
        <button class="nm-ibtn" data-a="collapse" title="Sembunyikan">${ICON.down}</button>
      </div>
      <div class="nm-list"></div>`;

    const list = panel.querySelector(".nm-list") as HTMLElement;
    if (status === "loading") {
      for (let i = 0; i < Math.min(settings.count, 4); i++) list.insertAdjacentHTML("beforeend", `<div class="nm-skel"></div>`);
    } else if (status === "generating") {
      list.innerHTML = `<div class="nm-msg">Menunggu balasan… saran baru akan muncul otomatis.</div>`;
    } else if (status === "error") {
      list.innerHTML = `<div class="nm-msg"></div>`;
      (list.firstChild as HTMLElement).textContent = errorMsg || "Gagal membuat saran.";
    } else if (!items.length) {
      list.innerHTML = `<div class="nm-msg">Tekan ↻ untuk membuat saran.</div>`;
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
        list.appendChild(b);
      });
    }

    panel.querySelectorAll<HTMLElement>("[data-a]").forEach((el) => {
      el.onclick = () => {
        const a = el.dataset.a;
        if (a === "auto") settings.autoSend = !settings.autoSend;
        if (a === "collapse") settings.collapsed = true;
        if (a === "refresh") return request();
        save();
        render();
      };
    });
    position();
  }

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

    if (msg.type === "generation-started") {
      status = "generating";
      items = [];
      render();
    } else if (msg.type === "generation-ended") {
      status = "idle";
      if (settings.autoGenerate) request();
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
    }
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

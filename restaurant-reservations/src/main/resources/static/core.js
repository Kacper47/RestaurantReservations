(function () {
  const ADMIN_SESSION_KEY = "restaurantAdminSession";
  const LARGE_RESERVATION_MESSAGE = "For reservations above 10 guests, please contact us by phone.";

  function $(id) {
    return document.getElementById(id);
  }

  async function apiGet(url, headers = {}) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function apiJson(method, url, body, headers = {}) {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    if (r.status === 204) return null;
    return r.json();
  }

  function setResult(el, ok, msg) {
    if (!el) return;
    el.classList.remove("ok", "err");
    el.classList.add("result", ok ? "ok" : "err");
    el.textContent = msg;
  }

  function digitsOnly(value) {
    return String(value ?? "").replace(/\D/g, "");
  }

  function formatPhone(value) {
    const digits = digitsOnly(value).slice(0, 9);
    const parts = digits.match(/.{1,3}/g);
    return parts ? parts.join("-") : "";
  }

  function normalizePhoneForApi(value) {
    return digitsOnly(value).slice(0, 9);
  }

  function attachPhoneFormatter(input) {
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = formatPhone(input.value);
    });
  }

  function validateGuestsInput(input, resultEl) {
    if (!input || !input.value) return true;
    const guests = Number(input.value);
    if (Number.isFinite(guests) && guests <= 10) {
      input.setCustomValidity("");
      return true;
    }
    input.setCustomValidity(LARGE_RESERVATION_MESSAGE);
    input.reportValidity();
    setResult(resultEl, false, LARGE_RESERVATION_MESSAGE);
    return false;
  }

  function isQuarterHour(value) {
    if (!value) return false;
    const parts = String(value).split(":");
    if (parts.length < 2) return false;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m % 15 === 0;
  }

  function validateQuarterHourInput(input, resultEl) {
    if (!input || !input.value) return true;
    if (isQuarterHour(input.value)) {
      input.setCustomValidity("");
      return true;
    }
    const msg = "Time must be in 15-minute intervals: 00, 15, 30, or 45.";
    input.setCustomValidity(msg);
    input.reportValidity();
    setResult(resultEl, false, msg);
    return false;
  }

  function todayIso() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function plusDays(isoDate, delta) {
    const d = new Date(`${isoDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  function saveAdminSession(session) {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  }

  function getAdminSession() {
    try {
      const raw = localStorage.getItem(ADMIN_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearAdminSession() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }

  function renderAccountBadge() {
    const badge = $("accountBadge");
    if (!badge) return;
    const session = getAdminSession();
    if (!session?.role || !session?.name) {
      badge.classList.add("hidden");
      badge.textContent = "";
      return;
    }
    badge.textContent = `Account: ${session.role} ${session.name}`;
    badge.classList.remove("hidden");
  }

  function renderTableOptions(selectEl, tables, emptyMessage, includeNoChange = false, currentTableId = null) {
    selectEl.innerHTML = "";
    if (includeNoChange) {
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = currentTableId ? `(no change, current #${currentTableId})` : "(no change)";
      selectEl.appendChild(emptyOpt);
    }
    if (!tables.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = emptyMessage;
      selectEl.appendChild(opt);
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;
    for (const t of tables) {
      const opt = document.createElement("option");
      opt.value = String(t.id);
      opt.textContent = `Table #${t.id} (${t.seats} seats)`;
      selectEl.appendChild(opt);
    }
  }

  function createTableTile(table, extra = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tableTile";
    if (extra.className) button.classList.add(extra.className);
    button.innerHTML = `<div class="title">Table #${table.id}</div><div class="small">${table.seats} seats</div>`;
    if (extra.footer) {
      const foot = document.createElement("div");
      foot.className = "small";
      foot.textContent = extra.footer;
      button.appendChild(foot);
    }
    return button;
  }

  function attachDatePickerButtons() {
    document.querySelectorAll("[data-date-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = $(button.dataset.dateTarget);
        if (!target) return;
        if (typeof target.showPicker === "function") {
          target.showPicker();
          return;
        }
        target.focus();
        target.click();
      });
    });
  }

  window.AppCore = {
    $, apiGet, apiJson, setResult,
    normalizePhoneForApi, attachPhoneFormatter,
    validateGuestsInput, validateQuarterHourInput,
    todayIso, plusDays,
    saveAdminSession, getAdminSession, clearAdminSession, renderAccountBadge,
    renderTableOptions, createTableTile,
    attachDatePickerButtons
  };
})();

function $(id) { return document.getElementById(id); }

const LARGE_RESERVATION_MESSAGE = "Dla rezerwacji powyżej 10 osób prosimy o kontakt telefoniczny.";

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

function setResult(el, ok, msg) {
  if (!el) return;
  el.classList.remove("ok", "err");
  el.classList.add("result", ok ? "ok" : "err");
  el.textContent = msg;
}

function validateGuestsInput(input, resultEl) {
  if (!input || !input.value) {
    return true;
  }

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

function renderTableOptions(selectEl, tables, emptyMessage, includeNoChange = false, currentTableId = null) {
  selectEl.innerHTML = "";

  if (includeNoChange) {
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = currentTableId ? `(bez zmiany, obecnie #${currentTableId})` : "(bez zmiany)";
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
    opt.textContent = `Stolik #${t.id} (${t.seats} miejsc)`;
    selectEl.appendChild(opt);
  }
}

async function loadTablesIntoSelect(selectEl) {
  const tables = await apiGet("/api/tables");
  renderTableOptions(selectEl, tables, "Brak stolików");
}

async function fetchAvailableTables({ date, time, guests }) {
  if (!date || !time || !guests || guests > 10) {
    return [];
  }

  const url = `/api/tables/available?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&guests=${encodeURIComponent(guests)}`;
  return apiGet(url);
}

async function loadAvailableTables(selectEl) {
  const date = $("date")?.value;
  const time = $("time")?.value;
  const guests = Number(document.querySelector('#addForm [name="guests"]')?.value || "0");

  if (!date || !time || !guests || guests > 10) {
    selectEl.innerHTML = "";
    selectEl.disabled = true;
    return;
  }

  const tables = await fetchAvailableTables({ date, time, guests });
  renderTableOptions(selectEl, tables, "Brak wolnych stolików");
}

function initAddPage() {
  const form = $("addForm");
  if (!form) return;

  const result = $("result");
  const select = $("tableSelect");
  const dateEl = $("date");
  const timeEl = $("time");
  const phoneEl = form.elements.phone;
  const guestsEl = form.elements.guests;

  attachPhoneFormatter(phoneEl);

  const refreshTables = () => loadAvailableTables(select).catch(console.error);

  dateEl.addEventListener("change", refreshTables);
  timeEl.addEventListener("change", refreshTables);
  guestsEl.addEventListener("input", () => {
    if (validateGuestsInput(guestsEl, result)) {
      refreshTables();
    }
  });

  refreshTables();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      if (!validateGuestsInput(guestsEl, result)) return;

      const data = Object.fromEntries(new FormData(form));
      data.guests = Number(data.guests);
      data.phone = normalizePhoneForApi(data.phone);
      data.tableId = Number(data.tableId);

      const created = await apiJson("POST", "/api/reservations", data);
      setResult(result, true, `Rezerwacja utworzona. Kod: ${created.code}`);
      form.reset();
      select.innerHTML = "";
      select.disabled = true;
    } catch (err) {
      setResult(result, false, err.message || "Błąd");
    }
  });
}

function initEditPage() {
  const cancelBtn = $("cancelBtn");
  const lookupForm = $("lookupForm");
  if (!lookupForm) return;

  const lookupResult = $("lookupResult");
  const editCard = $("editCard");
  const editForm = $("editForm");
  const editResult = $("editResult");
  const editSelect = $("editTableSelect");
  const lookupPhoneEl = lookupForm.elements.phone;
  const editDateEl = $("editDate");
  const editTimeEl = $("editTime");
  const editGuestsEl = $("editGuests");

  let currentPhone = null;
  let currentCode = null;
  let currentReservation = null;

  attachPhoneFormatter(lookupPhoneEl);

  loadTablesIntoSelect(editSelect).catch(() => {});
  renderTableOptions(editSelect, [], "Brak pasujących stolików", true);

  async function refreshEditTables() {
    if (!currentReservation) return;

    const guestsValue = editGuestsEl.value ? Number(editGuestsEl.value) : Number(currentReservation.guests);
    if (editGuestsEl.value && !validateGuestsInput(editGuestsEl, editResult)) {
      return;
    }

    const date = editDateEl.value || currentReservation.date;
    const time = editTimeEl.value || currentReservation.time;
    const tables = await fetchAvailableTables({ date, time, guests: guestsValue });
    const currentTable = currentReservation.table;
    const currentIncluded = currentTable && tables.some((t) => t.id === currentTable.id);
    const mergedTables = currentIncluded || !currentTable ? tables : [currentTable, ...tables];

    renderTableOptions(
      editSelect,
      mergedTables,
      "Brak pasujących wolnych stolików",
      true,
      currentTable?.id ?? null
    );
    editSelect.value = "";
  }

  editDateEl?.addEventListener("change", () => refreshEditTables().catch(console.error));
  editTimeEl?.addEventListener("change", () => refreshEditTables().catch(console.error));
  editGuestsEl?.addEventListener("input", () => refreshEditTables().catch(console.error));

  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(lookupForm));
      const normalizedPhone = normalizePhoneForApi(data.phone);
      const r = await apiGet(`/api/reservations/lookup?phone=${encodeURIComponent(normalizedPhone)}&code=${encodeURIComponent(data.code)}`);

      currentPhone = normalizedPhone;
      currentCode = data.code;
      currentReservation = r;

      setResult(
        lookupResult,
        true,
        `Znaleziono:
        Data: ${r.date},
        Godzina: ${r.time},
        Ilość osób: ${r.guests},
        Stolik: #${r.table?.id} (${r.table?.seats}os),
        Typ: ${r.meetingType},
        Uwagi: ${r.description}`
      );
      editCard.style.display = "block";
      editForm.reset();
      refreshEditTables().catch(console.error);
    } catch (err) {
      currentReservation = null;
      editCard.style.display = "none";
      setResult(lookupResult, false, "Nie znaleziono rezerwacji - podano błędne dane");
    }
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      if (!validateGuestsInput(editGuestsEl, editResult)) return;

      const data = Object.fromEntries(new FormData(editForm));
      const payload = {
        phone: currentPhone,
        code: currentCode,
        date: data.date || null,
        time: data.time || null,
        guests: data.guests ? Number(data.guests) : 0,
        tableId: data.tableId ? Number(data.tableId) : null,
        meetingType: data.meetingType ? data.meetingType.trim() : null,
        description: data.description ? data.description.trim() : null
      };

      const updated = await apiJson("PUT", "/api/reservations/edit", payload);
      currentReservation = updated;
      setResult(
        editResult,
        true,
        `Zmieniono:
        Data: ${updated.date},
        Godzina: ${updated.time},
        Ilość osób: ${updated.guests},
        Stolik: #${updated.table?.id} (${updated.table?.seats}os),
        Typ: ${updated.meetingType},
        Uwagi: ${updated.description}`
      );
      editForm.reset();
      refreshEditTables().catch(console.error);
    } catch (err) {
      setResult(editResult, false, err.message || "Błąd");
    }
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      try {
        if (!currentPhone || !currentCode) {
          setResult(editResult, false, "Najpierw wyszukaj rezerwację.");
          return;
        }

        await apiJson("DELETE", "/api/reservations/by-code", {
          phone: currentPhone,
          code: currentCode
        });

        setResult(editResult, true, "Rezerwacja została odwołana.");
        editCard.style.display = "none";
      } catch (err) {
        setResult(editResult, false, "Błąd odwołania rezerwacji.");
      }
    });
  }
}

function initAdminPage() {
  const loginForm = $("adminLoginForm");
  if (!loginForm) return;

  const passEl = $("adminPass");
  const dateEl = $("adminDate");
  const msgEl = $("adminMsg");
  const tablesGrid = $("tablesGrid");
  const resList = $("reservationsList");
  const clearFilterBtn = $("clearFilterBtn");

  let selectedTableId = null;

  function adminHeaders() {
    return { "X-ADMIN-PASS": passEl.value };
  }

  function renderTables(tables) {
    tablesGrid.innerHTML = "";
    for (const t of tables) {
      const div = document.createElement("div");
      div.className = "tableTile";
      div.innerHTML = `<div class="title">Stolik #${t.id}</div>
                       <div class="small">${t.seats} miejsc</div>`;
      div.addEventListener("click", () => {
        selectedTableId = t.id;
        loadAdminData().catch(() => {});
      });
      tablesGrid.appendChild(div);
    }
  }

  function renderReservations(reservations) {
    resList.innerHTML = "";
    const filtered = selectedTableId
      ? reservations.filter((r) => r.table && r.table.id === selectedTableId)
      : reservations;

    if (filtered.length === 0) {
      resList.innerHTML = `<div class="muted">Brak rezerwacji dla tej daty.</div>`;
      return;
    }

    for (const r of filtered) {
      const tableId = r.table?.id ?? r.tableId ?? "-";

      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="itemHead">
          <div>
            <div><span class="badge">${r.status}</span></div>
            <div class="muted">
              Kod: ${r.code} • Data: ${r.date} • Godzina: ${String(r.time).slice(0, 5)} • Stolik #${tableId} • Osoby: ${r.guests}
            </div>
          </div>
          <button class="btn danger js-cancel" ${r.status === "CANCELED" ? "disabled" : ""}>Anuluj</button>
        </div>
      `;

      item.querySelector(".js-cancel")?.addEventListener("click", async () => {
        await fetch(`/api/reservations/${r.id}`, { method: "DELETE" });
        await loadAdminData();
      });

      resList.appendChild(item);
    }
  }

  async function loadAdminData() {
    try {
      const date = dateEl.value;
      if (!date) {
        setResult(msgEl, false, "Wybierz datę.");
        return;
      }

      const tables = await apiGet("/api/tables");
      renderTables(tables);

      const raw = await apiGet(`/api/admin/reservations?date=${encodeURIComponent(date)}`, adminHeaders());
      const reservations = Array.isArray(raw) ? raw : (raw.items ?? raw.content ?? []);
      renderReservations(reservations);

      let hello = "";
      try {
        const me = await apiGet(`/api/staff/login?code=${encodeURIComponent(passEl.value)}`);
        hello = `Witaj, ${me.role} ${me.name}. `;
      } catch (_) {
      }

      const baseMsg = selectedTableId ? `Filtr stolika: #${selectedTableId}` : "Załadowano dane.";
      setResult(msgEl, true, `${hello}${baseMsg}`);
    } catch (err) {
      setResult(msgEl, false, "Błąd (czy hasło jest poprawne?)");
    }
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    selectedTableId = null;
    loadAdminData().catch(() => {});
  });

  clearFilterBtn?.addEventListener("click", () => {
    selectedTableId = null;
    loadAdminData().catch(() => {});
  });

  if (!dateEl.value) {
    const d = new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dateEl.value = iso;
  }
}

function initReviewsPage() {
  const form = $("reviewForm");
  if (!form) return;

  const msg = $("reviewMsg");
  const list = $("reviewsList");

  async function load() {
    const reviews = await apiGet("/api/reviews");
    list.innerHTML = "";
    for (const r of reviews) {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `<div class="itemHead">
          <div><b>Ocena: ${r.rate}/5</b></div>
        </div>
        <div class="muted">${r.description ?? ""}</div>`;
      list.appendChild(item);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(form));
      data.rate = Number(data.rate);
      await apiJson("POST", "/api/reviews", data);
      setResult(msg, true, "Dodano opinię.");
      form.reset();
      await load();
    } catch (err) {
      setResult(msg, false, "Błąd");
    }
  });

  load().catch(() => {});
}




attachDatePickerButtons();
initReviewsPage();
initAddPage();
initEditPage();
initAdminPage();

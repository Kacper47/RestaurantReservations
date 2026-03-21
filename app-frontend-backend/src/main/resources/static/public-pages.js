(function () {
  const C = window.AppCore;
  if (!C) return;

  async function fetchAvailableTables({ date, time, guests }) {
    if (!date || !time || !guests || guests > 10) return [];
    const url = `/api/tables/available?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&guests=${encodeURIComponent(guests)}`;
    return C.apiGet(url);
  }

  function initEntryPage() {
    const panel = C.$("adminLoginPanel");
    if (!panel) return;

    const openBtn = C.$("openAdminLoginBtn");
    const form = C.$("adminEntryForm");
    const codeEl = C.$("adminCode");
    const nameEl = C.$("adminName");
    const msgEl = C.$("adminEntryMsg");

    openBtn?.addEventListener("click", () => panel.classList.remove("hidden"));

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const code = (codeEl.value || "").trim();
        const name = (nameEl.value || "").trim();
        if (!code || !name) {
          C.setResult(msgEl, false, "Provide both code and name.");
          return;
        }
        const me = await C.apiGet(`/api/staff/login?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
        C.saveAdminSession({ code, role: me.role, name: me.name });
        window.location.href = "/guest.html";
      } catch (_) {
        C.setResult(msgEl, false, "Invalid code or name.");
      }
    });
  }

  function initGuestPage() {
    const adminPanelCard = C.$("adminPanelCard");
    if (!adminPanelCard) return;
    const backBtn = C.$("guestBackBtn");
    const session = C.getAdminSession();
    if (session?.code) {
      adminPanelCard.classList.remove("hidden");
      adminPanelCard.setAttribute("aria-hidden", "false");
    } else {
      adminPanelCard.classList.add("hidden");
      adminPanelCard.setAttribute("aria-hidden", "true");
    }
    backBtn?.addEventListener("click", () => C.clearAdminSession());
  }

  function initAddPage() {
    const form = C.$("addForm");
    if (!form) return;

    const result = C.$("result");
    const select = C.$("tableSelect");
    const planEl = C.$("bookingTablePlan");
    const dateEl = C.$("date");
    const timeEl = C.$("time");
    const phoneEl = form.elements.phone;
    const guestsEl = form.elements.guests;

    let selectedTableId = null;
    let availableTables = [];

    C.attachPhoneFormatter(phoneEl);
    if (!dateEl.value) dateEl.value = C.todayIso();
    timeEl.step = 900;

    function renderPlan() {
      planEl.innerHTML = "";
      if (!availableTables.length) {
        planEl.innerHTML = `<div class="muted">No available tables for the selected slot.</div>`;
        return;
      }
      for (const table of availableTables) {
        const tile = C.createTableTile(table, { className: "available", footer: "wolny" });
        if (selectedTableId === table.id) tile.classList.add("selected");
        tile.addEventListener("click", () => {
          selectedTableId = table.id;
          select.value = String(table.id);
          renderPlan();
        });
        planEl.appendChild(tile);
      }
    }

    async function refreshTables() {
      const date = dateEl.value;
      const time = timeEl.value;
      const guests = Number(guestsEl.value || "0");
      if (!C.validateQuarterHourInput(timeEl, result)) return;
      availableTables = await fetchAvailableTables({ date, time, guests });
      C.renderTableOptions(select, availableTables, "No available tables");
      const ids = new Set(availableTables.map((t) => t.id));
      if (selectedTableId && ids.has(selectedTableId)) {
        select.value = String(selectedTableId);
      } else if (availableTables.length) {
        selectedTableId = availableTables[0].id;
        select.value = String(selectedTableId);
      } else {
        selectedTableId = null;
      }
      renderPlan();
    }

    select.addEventListener("change", () => {
      selectedTableId = Number(select.value);
      renderPlan();
    });
    dateEl.addEventListener("change", () => refreshTables().catch(() => {}));
    timeEl.addEventListener("change", () => refreshTables().catch(() => {}));
    guestsEl.addEventListener("input", () => {
      if (C.validateGuestsInput(guestsEl, result)) refreshTables().catch(() => {});
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        if (!C.validateGuestsInput(guestsEl, result)) return;
        if (!C.validateQuarterHourInput(timeEl, result)) return;
        const data = Object.fromEntries(new FormData(form));
        data.guests = Number(data.guests);
        data.phone = C.normalizePhoneForApi(data.phone);
        data.tableId = Number(data.tableId);
        const created = await C.apiJson("POST", "/api/reservations", data);
        C.setResult(result, true, `Reservation created. Code: ${created.code}`);
        form.reset();
        dateEl.value = C.todayIso();
        selectedTableId = null;
        await refreshTables();
      } catch (err) {
        C.setResult(result, false, err.message || "Error");
      }
    });

    refreshTables().catch(() => {});
  }

  function initEditPage() {
    const cancelBtn = C.$("cancelBtn");
    const lookupForm = C.$("lookupForm");
    if (!lookupForm) return;

    const lookupResult = C.$("lookupResult");
    const editCard = C.$("editCard");
    const editForm = C.$("editForm");
    const editResult = C.$("editResult");
    const editSelect = C.$("editTableSelect");
    const lookupPhoneEl = lookupForm.elements.phone;
    const editDateEl = C.$("editDate");
    const editTimeEl = C.$("editTime");
    const editGuestsEl = C.$("editGuests");
    editTimeEl.step = 900;

    let currentPhone = null;
    let currentCode = null;
    let currentReservation = null;

    C.attachPhoneFormatter(lookupPhoneEl);
    C.renderTableOptions(editSelect, [], "No matching tables", true);

    async function refreshEditTables() {
      if (!currentReservation) return;
      const guestsValue = editGuestsEl.value ? Number(editGuestsEl.value) : Number(currentReservation.guests);
      if (editGuestsEl.value && !C.validateGuestsInput(editGuestsEl, editResult)) return;
      const date = editDateEl.value || currentReservation.date;
      const time = editTimeEl.value || currentReservation.time;
      const tables = await fetchAvailableTables({ date, time, guests: guestsValue });
      const currentTable = currentReservation.table;
      const hasCurrent = currentTable && tables.some((t) => t.id === currentTable.id);
      const merged = hasCurrent || !currentTable ? tables : [currentTable, ...tables];
      C.renderTableOptions(editSelect, merged, "No available tables", true, currentTable?.id ?? null);
      editSelect.value = "";
    }

    lookupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const data = Object.fromEntries(new FormData(lookupForm));
        const normalizedPhone = C.normalizePhoneForApi(data.phone);
        const r = await C.apiGet(`/api/reservations/lookup?phone=${encodeURIComponent(normalizedPhone)}&code=${encodeURIComponent(data.code)}`);
        currentPhone = normalizedPhone;
        currentCode = data.code;
        currentReservation = r;
        C.setResult(lookupResult, true, `Reservation found: ${r.date} ${r.time}, table #${r.table?.id}`);
        editCard.style.display = "block";
        editForm.reset();
        refreshEditTables().catch(() => {});
      } catch (_) {
        currentReservation = null;
        editCard.style.display = "none";
        C.setResult(lookupResult, false, "Reservation not found.");
      }
    });

    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        if (!C.validateGuestsInput(editGuestsEl, editResult)) return;
        if (editTimeEl.value && !C.validateQuarterHourInput(editTimeEl, editResult)) return;
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
        const updated = await C.apiJson("PUT", "/api/reservations/edit", payload);
        currentReservation = updated;
        C.setResult(editResult, true, `Updated: ${updated.date} ${updated.time}, table #${updated.table?.id}`);
        editForm.reset();
        refreshEditTables().catch(() => {});
      } catch (err) {
        C.setResult(editResult, false, err.message || "Error");
      }
    });

    cancelBtn?.addEventListener("click", async () => {
      try {
        if (!currentPhone || !currentCode) {
          C.setResult(editResult, false, "Find a reservation first.");
          return;
        }
        await C.apiJson("DELETE", "/api/reservations/by-code", { phone: currentPhone, code: currentCode });
        C.setResult(editResult, true, "Reservation has been canceled.");
        editCard.style.display = "none";
      } catch (_) {
        C.setResult(editResult, false, "Failed to cancel reservation.");
      }
    });

    editDateEl?.addEventListener("change", () => refreshEditTables().catch(() => {}));
    editTimeEl?.addEventListener("change", () => refreshEditTables().catch(() => {}));
    editGuestsEl?.addEventListener("input", () => refreshEditTables().catch(() => {}));
  }

  function initReviewsPage() {
    const form = C.$("reviewForm");
    if (!form) return;
    const msg = C.$("reviewMsg");
    const list = C.$("reviewsList");

    async function load() {
      const reviews = await C.apiGet("/api/reviews");
      list.innerHTML = "";
      for (const r of reviews) {
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `<div class="itemHead"><div><b>Rating: ${r.rate}/5</b></div></div><div class="muted">${r.description ?? ""}</div>`;
        list.appendChild(item);
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const data = Object.fromEntries(new FormData(form));
        data.rate = Number(data.rate);
        await C.apiJson("POST", "/api/reviews", data);
        C.setResult(msg, true, "Review added.");
        form.reset();
        await load();
      } catch (_) {
        C.setResult(msg, false, "Error");
      }
    });

    load().catch(() => {});
  }

  window.PublicPages = { initEntryPage, initGuestPage, initAddPage, initEditPage, initReviewsPage };
})();

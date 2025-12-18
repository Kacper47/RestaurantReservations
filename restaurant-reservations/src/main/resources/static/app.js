function $(id) { return document.getElementById(id); }

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

async function loadTablesIntoSelect(selectEl) {
  const tables = await apiGet("/api/tables");
  selectEl.innerHTML = "";
  for (const t of tables) {
    const opt = document.createElement("option");
    opt.value = String(t.id);
    opt.textContent = `Stolik #${t.id} (${t.seats} miejsc)`;
    selectEl.appendChild(opt);
  }
}

async function loadAvailableTables(selectEl) {
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  if (!date || !time) {
    selectEl.innerHTML = "";
    return;
  }

  const tables = await apiGet(`/api/tables/available?date=${date}&time=${time}`);
  selectEl.innerHTML = "";

  for (const t of tables) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `Stolik #${t.id} (${t.seats} miejsc)`;
    selectEl.appendChild(opt);
  }
}

async function loadAvailableTablesIntoSelect() {
  const dateEl = document.getElementById("date");
  const timeEl = document.getElementById("time");
  const tableEl = document.getElementById("tableSelect");

  if (!dateEl || !timeEl || !tableEl) return;

  async function refresh() {
    const date = dateEl.value;
    const time = timeEl.value;
    if (!date || !time) return;

    const url = `/api/tables/available?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("tables/available failed", res.status);
      return;
    }

    const tables = await res.json();
    tableEl.innerHTML = "";

    if (!tables.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Brak wolnych stolików";
      tableEl.appendChild(opt);
      tableEl.disabled = true;
      return;
    }

    tableEl.disabled = false;
    for (const t of tables) {
      const opt = document.createElement("option");
      opt.value = String(t.id);
      opt.textContent = `Stolik #${t.id} (${t.seats} miejsc)`;
      tableEl.appendChild(opt);
    }
  }

  dateEl.addEventListener("change", refresh);
  timeEl.addEventListener("change", refresh);

  // jeśli data/godzina już są ustawione (np. domyślne), to od razu dociągnij
  refresh().catch(console.error);
}

loadAvailableTablesIntoSelect();

function setResult(el, ok, msg) {
  if (!el) return;
  el.classList.remove("ok", "err");
  el.classList.add("result", ok ? "ok" : "err");
  el.textContent = msg;
}

function initAddPage() {
  const form = $("addForm");
  if (!form) return;

  const result = document.getElementById("result");

  const select = document.getElementById("tableSelect");
  const dateEl = document.getElementById("date");
  const timeEl = document.getElementById("time");

  dateEl.addEventListener("change", () => loadAvailableTables(select));
  timeEl.addEventListener("change", () => loadAvailableTables(select));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(form));
      data.guests = Number(data.guests);
      data.tableId = Number(data.tableId);

      const created = await apiJson("POST", "/api/reservations", data);
      setResult(result, true, `Rezerwacja utworzona. Kod: ${created.code}`);
      form.reset();
      loadAvailableTables(select);
    } catch (err) {
      setResult(result, false, "Błąd");
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

  let currentPhone = null;
  let currentCode = null;

  loadTablesIntoSelect(editSelect).catch(() => { /* ok */ });
  // opcja "bez zmiany stolika"
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "(bez zmiany)";
  editSelect.insertBefore(emptyOpt, editSelect.firstChild);

  lookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(lookupForm));
      const r = await apiGet(`/api/reservations/lookup?phone=${encodeURIComponent(data.phone)}&code=${encodeURIComponent(data.code)}`);

      currentPhone = data.phone;
      currentCode = data.code;

      setResult(lookupResult, true,
        `Znaleziono: 
        Data: ${r.date},
        Godzina: ${r.time},
        Ilość osób: ${r.guests},
        Stolik: #${r.table?.id} (${r.table?.seats}os),
        Typ: ${r.meetingType},
        Uwagi: ${r.description}
        `);
      editCard.style.display = "block";
    } catch (err) {
      editCard.style.display = "none";
      setResult(lookupResult, false, "Nie znaleziono rezerwacji - podano błędne dane");
    }
  });

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
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
      setResult(editResult, true,
        `Zmieniono: 
        Data: ${updated.date},
        Godzina: ${updated.time},
        Ilość osób: ${updated.guests},
        Stolik: #${updated.table?.id} (${updated.table?.seats}os),
        Typ: ${updated.meetingType},
        Uwagi: ${updated.description}
        `);
      editForm.reset();
    } catch (err) {
      setResult(editResult, false, "Błąd");
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
  const createTableBtn = $("createTableBtn");
  const newTableSeats = $("newTableSeats");
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
    console.log("BEFORE LOOP");

    resList.innerHTML = "";
    const filtered = selectedTableId
      ? reservations.filter(r => r.table && r.table.id === selectedTableId)
      : reservations;

    if (filtered.length === 0) {
      resList.innerHTML = `<div class="muted">Brak rezerwacji dla tej daty.</div>`;
      return;
    }


    for (const r of filtered) {
      const customerName =
        (r.customerName && r.customerName.trim()) ||
        (r.customer?.name && r.customer.name.trim()) ||
        "—";

      const phone =
        (r.customerPhone && String(r.customerPhone).trim()) ||
        (r.customer?.phone && String(r.customer.phone).trim()) ||
        "—";
      const tableId = r.table?.id ?? r.tableId ?? "—";

      const item = document.createElement("div");
      item.className = "item";

      console.log("RES", r);

      item.innerHTML = `
        <div class="itemHead">
          <div>
            <div><span class="badge">${r.status}</span></div>
            <div class="muted">
              Kod: ${r.code} • Data: ${r.date} • Godzina: ${String(r.time).slice(0,5)} • Stolik #${tableId} • Osoby: ${r.guests}
            </div>
          </div>
          <button class="btn danger js-cancel" ${r.status === "CANCELED" ? "disabled" : ""}>Anuluj</button>
        </div>
      `;

      item.querySelector(".js-cancel")?.addEventListener("click", async () => {
        await cancelReservation(r.id);
        // po anulowaniu: odśwież listę (najprościej)
        await loadReservationsForSelectedDate(); // <- podmień na Twoją funkcję odświeżania
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
        
        
      const code = passEl.value;
          
      let hello = "";
      try {
        const me = await apiGet(`/api/staff/login?code=${encodeURIComponent (code)}`);
        hello = `Witaj, ${me.role} ${me.name}. `;
      } catch (_) {
        // nie ma w staff -> traktuj jako admin
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

  clearFilterBtn.addEventListener("click", () => {
    selectedTableId = null;
    loadAdminData().catch(() => {});
  });

  // createTableBtn.addEventListener("click", async () => {
  //   try {
  //     const seats = Number(newTableSeats.value || "4");
  //     await apiJson("POST", "/api/tables", { seats });
  //     await loadAdminData();
  //     setResult(msgEl, true, "Dodano stolik.");
  //   } catch (err) {
  //     setResult(msgEl, false, "Błąd dodania stolika: " + String(err));
  //   }
  // });

  // ustawia domyślną datę na dziś
  if (!dateEl.value) {
    const d = new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    dateEl.value = iso;
  }
}

function initReviewsPage() {
  const form = document.getElementById("reviewForm");
  if (!form) return;

  const msg = document.getElementById("reviewMsg");
  const list = document.getElementById("reviewsList");

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
initReviewsPage();

initAddPage();
initEditPage();
initAdminPage();

(function () {
  const C = window.AppCore;
  if (!C) return;

  function initAdminPage() {
    const dateEl = C.$("adminDate");
    if (!dateEl) return;

    const msgEl = C.$("adminMsg");
    const tablesGrid = C.$("tablesGrid");
    const resList = C.$("reservationsList");
    const prevDayBtn = C.$("prevDayBtn");
    const nextDayBtn = C.$("nextDayBtn");

    let selectedTableId = null;
    let reservations = [];
    let tablesCache = [];

    const session = C.getAdminSession();
    if (!session?.code || !session?.name) {
      C.setResult(msgEl, false, "No administrator session. Sign in on the start page.");
      tablesGrid.innerHTML = "";
      resList.innerHTML = "";
      return;
    }

    dateEl.value = dateEl.value || C.todayIso();

    function renderReservations() {
      resList.innerHTML = "";
      const filtered = selectedTableId
        ? reservations.filter((r) => (r.table?.id ?? r.tableId) === selectedTableId)
        : reservations;

      if (!filtered.length) {
        resList.innerHTML = `<div class="muted">No reservations for this date.</div>`;
        return;
      }

      for (const r of filtered) {
        const item = document.createElement("div");
        item.className = "item";
        const tableId = r.table?.id ?? r.tableId ?? "-";
        item.innerHTML = `
          <div class="itemHead">
            <div>
              <div><span class="badge">${r.status}</span></div>
              <div class="muted">Code: ${r.code} | ${r.date} ${String(r.time).slice(0, 5)} | Table #${tableId} | Guests: ${r.guests}</div>
            </div>
            <button class="btn danger table-cancel">Cancel</button>
          </div>
        `;
        item.querySelector(".table-cancel")?.addEventListener("click", async () => {
          await fetch(`/api/admin/reservations/${r.id}`, { method: "DELETE" });
          await loadAdminData();
        });
        resList.appendChild(item);
      }
    }

    function renderTables() {
      tablesGrid.innerHTML = "";
      const active = reservations.filter((r) => r.status !== "CANCELED");

      for (const table of tablesCache) {
        const count = active.filter((r) => (r.table?.id ?? r.tableId) === table.id).length;
        const style = count > 0 ? "tooSmall" : "available";
        const footer = count > 0 ? `${count} reservations` : "free all day";

        const tile = C.createTableTile(table, { className: style, footer });
        if (selectedTableId === table.id) tile.classList.add("selected");
        tile.addEventListener("click", () => {
          selectedTableId = selectedTableId === table.id ? null : table.id;
          renderTables();
          renderReservations();
        });
        tablesGrid.appendChild(tile);
      }
    }

    async function loadAdminData() {
      try {
        const date = dateEl.value;
        if (!date) return;

        await C.apiGet(`/api/staff/login?code=${encodeURIComponent(session.code)}&name=${encodeURIComponent(session.name)}`);
        const data = await C.apiGet(`/api/admin/dashboard?date=${encodeURIComponent(date)}`);
        tablesCache = Array.isArray(data.tables) ? data.tables : [];
        reservations = Array.isArray(data.reservations) ? data.reservations : [];

        renderTables();
        renderReservations();
        C.setResult(msgEl, true, `Loaded date: ${date}.`);
      } catch (_) {
        C.setResult(msgEl, false, "Administrator session expired. Please sign in again.");
        C.clearAdminSession();
      }
    }

    dateEl.addEventListener("change", () => {
      selectedTableId = null;
      loadAdminData().catch(() => {});
    });
    prevDayBtn?.addEventListener("click", () => {
      dateEl.value = C.plusDays(dateEl.value, -1);
      selectedTableId = null;
      loadAdminData().catch(() => {});
    });
    nextDayBtn?.addEventListener("click", () => {
      dateEl.value = C.plusDays(dateEl.value, 1);
      selectedTableId = null;
      loadAdminData().catch(() => {});
    });

    loadAdminData().catch(() => {});
  }

  window.AdminPage = { initAdminPage };
})();

(function () {
  const C = window.AppCore;
  const P = window.PublicPages;
  const A = window.AdminPage;
  if (!C) return;

  C.renderAccountBadge();
  C.attachDatePickerButtons();

  P?.initEntryPage();
  P?.initGuestPage();
  P?.initAddPage();
  P?.initEditPage();
  P?.initReviewsPage();
  A?.initAdminPage();
})();

function currentOtId() {
  const match = window.location.hash.match(/^#\/ots\/([0-9a-f-]+)/i);
  return match?.[1] || '';
}

function fixEditBackButton() {
  const id = currentOtId();
  if (!id || !window.location.hash.endsWith('/editar')) return;
  const broken = [...document.querySelectorAll('[data-go]')].find((element) => {
    const value = element.getAttribute('data-go') || '';
    return value.includes("'+id+'");
  });
  if (broken) broken.setAttribute('data-go', `#/ots/${id}`);
}

function updateOtNavigationState() {
  const hash = window.location.hash;
  document.querySelectorAll('#otv3-nav a').forEach((link) => {
    const href = link.getAttribute('href');
    let active = href === hash;
    if (href === '#/ots' && /^#\/ots\/[0-9a-f-]+/i.test(hash)) active = true;
    link.classList.toggle('active', active);
  });
}

function refreshChecklistSummary() {
  if (!window.location.hash.endsWith('/checklist')) return;
  const cards = [...document.querySelectorAll('.otv3-check')];
  const summary = document.querySelector('.otv3-summary');
  if (!summary || !cards.length) return;
  const completed = cards.filter((card) => card.querySelector('.otv3-result')?.value !== 'pendiente').length;
  const noOk = cards.filter((card) => card.querySelector('.otv3-result')?.value === 'no_ok').length;
  summary.innerHTML = `<span>${completed}/${cards.length} completados</span><span>${noOk} No OK</span>`;
}

function applyOtFixes() {
  fixEditBackButton();
  updateOtNavigationState();
  refreshChecklistSummary();
}

const observer = new MutationObserver(() => applyOtFixes());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', applyOtFixes);
window.addEventListener('hashchange', applyOtFixes);
document.addEventListener('change', (event) => {
  if (event.target.matches('.otv3-result')) refreshChecklistSummary();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(applyOtFixes, 300));
} else {
  setTimeout(applyOtFixes, 300);
}

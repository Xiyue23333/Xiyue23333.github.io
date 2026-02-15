const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const t of tabs) t.classList.remove('active');
    for (const panel of panels) panel.classList.remove('active');

    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.target);
    if (target) target.classList.add('active');
  });
}

const drawerToggle = document.querySelector('.js-sidebar-toggle');
const drawer = document.getElementById('site-drawer');
const drawerOverlay = document.querySelector('[data-drawer-overlay]');
const drawerClose = document.querySelector('[data-drawer-close]');
const drawerLinks = document.querySelectorAll('.site-drawer-nav a');

if (drawerToggle && drawer && drawerOverlay && drawerClose) {
  let closeTimer = null;

  function openDrawer() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    drawerOverlay.hidden = false;
    requestAnimationFrame(() => {
      drawerOverlay.classList.add('visible');
    });
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    drawerToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    drawerOverlay.classList.remove('visible');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawerToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
    closeTimer = window.setTimeout(() => {
      drawerOverlay.hidden = true;
    }, 220);
  }

  drawerToggle.addEventListener('click', (event) => {
    event.preventDefault();
    if (drawer.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  for (const link of drawerLinks) {
    link.addEventListener('click', closeDrawer);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });
}

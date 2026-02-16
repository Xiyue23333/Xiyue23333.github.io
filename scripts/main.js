const drawerToggle = document.querySelector('.js-sidebar-toggle');
const drawer = document.getElementById('site-drawer');
const drawerOverlay = document.querySelector('[data-drawer-overlay]');
const drawerClose = document.querySelector('[data-drawer-close]');
const drawerLinks = drawer ? drawer.querySelectorAll('a') : [];

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

const drawerGroupToggles = document.querySelectorAll('[data-drawer-group-toggle]');

for (const toggle of drawerGroupToggles) {
  const targetId = toggle.getAttribute('data-target');
  const target = targetId ? document.getElementById(targetId) : null;
  if (!target) continue;

  const initOpen = target.classList.contains('open');
  toggle.classList.toggle('open', initOpen);
  toggle.setAttribute('aria-expanded', initOpen ? 'true' : 'false');

  toggle.addEventListener('click', () => {
    const isOpen = target.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggle.classList.toggle('open', isOpen);
  });
}

const COMMENT_KEY = 'mmc_comments_v1';
const commentForm = document.querySelector('[data-comment-form]');
const commentList = document.querySelector('[data-comment-list]');
const commentClear = document.querySelector('[data-comment-clear]');

function loadComments() {
  try {
    const raw = window.localStorage.getItem(COMMENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveComments(comments) {
  window.localStorage.setItem(COMMENT_KEY, JSON.stringify(comments));
}

function renderComments() {
  if (!commentList) return;
  const comments = loadComments();
  commentList.innerHTML = '';

  if (comments.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'message-empty';
    empty.textContent = '暂无留言，来写第一条吧。';
    commentList.appendChild(empty);
    return;
  }

  const ordered = comments.slice().reverse();
  for (const item of ordered) {
    const card = document.createElement('article');
    card.className = 'message-item';

    const head = document.createElement('div');
    head.className = 'message-item-head';

    const name = document.createElement('strong');
    name.textContent = item.name;

    const time = document.createElement('span');
    const timeValue = new Date(item.createdAt);
    time.textContent = Number.isNaN(timeValue.getTime())
      ? '未知时间'
      : timeValue.toLocaleString('zh-CN', { hour12: false });

    head.appendChild(name);
    head.appendChild(time);

    const body = document.createElement('p');
    body.textContent = item.message;

    card.appendChild(head);
    card.appendChild(body);
    commentList.appendChild(card);
  }
}

if (commentForm && commentList) {
  renderComments();

  commentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(commentForm);
    const name = String(formData.get('name') || '').trim();
    const message = String(formData.get('message') || '').trim();

    if (!name || !message) return;

    const comments = loadComments();
    comments.push({
      name: name.slice(0, 24),
      message: message.slice(0, 280),
      createdAt: new Date().toISOString(),
    });

    const capped = comments.slice(-80);
    saveComments(capped);
    commentForm.reset();
    renderComments();
  });

  if (commentClear) {
    commentClear.addEventListener('click', () => {
      const ok = window.confirm('确定清空当前浏览器中的所有留言吗？');
      if (!ok) return;
      window.localStorage.removeItem(COMMENT_KEY);
      renderComments();
    });
  }
}

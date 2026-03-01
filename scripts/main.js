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

function getCommentApiBase() {
  const meta = document.querySelector('meta[name="comment-api-base"]');
  const metaValue = meta ? String(meta.getAttribute('content') || '').trim() : '';
  const globalValue = typeof window.COMMENT_API_BASE === 'string' ? window.COMMENT_API_BASE.trim() : '';
  return globalValue || metaValue || '';
}

const COMMENT_API_BASE = getCommentApiBase();
const COMMENT_MODE = COMMENT_API_BASE ? 'remote' : 'local';

function loadCommentsLocal() {
  try {
    const raw = window.localStorage.getItem(COMMENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.slice().reverse();
  } catch {
    return [];
  }
}

function saveCommentsLocal(commentsOldestFirst) {
  window.localStorage.setItem(COMMENT_KEY, JSON.stringify(commentsOldestFirst));
}

async function loadCommentsRemote() {
  const url = new URL('/comments', COMMENT_API_BASE);
  url.searchParams.set('limit', '80');
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`加载留言失败（${res.status}）`);
  const data = await res.json();
  if (!data || data.ok !== true || !Array.isArray(data.comments)) return [];
  return data.comments;
}

async function postCommentRemote(name, message) {
  const url = new URL('/comments', COMMENT_API_BASE);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, message }),
  });
  if (!res.ok) throw new Error(`发布失败（${res.status}）`);
  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true) throw new Error('发布失败（服务返回异常）');
}

function renderCommentsError(message) {
  if (!commentList) return;
  commentList.innerHTML = '';

  const error = document.createElement('p');
  error.className = 'message-empty message-error';
  error.textContent = message;
  commentList.appendChild(error);
}

async function renderComments() {
  if (!commentList) return;
  commentList.innerHTML = '';

  let comments = [];
  try {
    comments = COMMENT_MODE === 'remote' ? await loadCommentsRemote() : loadCommentsLocal();
  } catch (error) {
    renderCommentsError(error instanceof Error ? error.message : '加载留言失败');
    return;
  }

  if (comments.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'message-empty';
    empty.textContent = '暂无留言，来写第一条吧。';
    commentList.appendChild(empty);
    return;
  }

  for (const item of comments) {
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

  if (commentClear) {
    if (COMMENT_MODE === 'remote') {
      commentClear.textContent = '刷新留言';
    }
  }

  commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(commentForm);
    const name = String(formData.get('name') || '').trim();
    const message = String(formData.get('message') || '').trim();

    if (!name || !message) return;

    if (COMMENT_MODE === 'remote') {
      try {
        await postCommentRemote(name.slice(0, 24), message.slice(0, 280));
        commentForm.reset();
        renderComments();
      } catch (error) {
        renderCommentsError(error instanceof Error ? error.message : '发布失败');
      }
      return;
    }

    const raw = window.localStorage.getItem(COMMENT_KEY);
    let commentsOldestFirst = [];
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      commentsOldestFirst = Array.isArray(parsed) ? parsed : [];
    } catch {
      commentsOldestFirst = [];
    }

    commentsOldestFirst.push({
      name: name.slice(0, 24),
      message: message.slice(0, 280),
      createdAt: new Date().toISOString(),
    });

    const capped = commentsOldestFirst.slice(-80);
    saveCommentsLocal(capped);
    commentForm.reset();
    renderComments();
  });

  if (commentClear) {
    commentClear.addEventListener('click', () => {
      if (COMMENT_MODE === 'remote') {
        renderComments();
        return;
      }
      const ok = window.confirm('确定清空当前浏览器中的所有留言吗？');
      if (!ok) return;
      window.localStorage.removeItem(COMMENT_KEY);
      renderComments();
    });
  }
}

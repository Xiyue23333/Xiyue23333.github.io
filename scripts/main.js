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

const splashText = document.querySelector('[data-splash-text]');

if (splashText) {
  const splashLines = [
    'Never gonna give you up!',
    'Press F to pay respects!',
    'The cake is a lie!',
    'Very wow!',
    'Stonks!',
    'It is Wednesday, my dudes!',
    'Emotional damage!',
    'Skill issue!',
    'Bonk! Go to horny jail!',
    'Are ya winning, son?',
    'This is fine.',
    'One does not simply mine diamonds!',
  ];
  const pick = splashLines[Math.floor(Math.random() * splashLines.length)];
  const tilt = -14 - Math.floor(Math.random() * 10);
  splashText.textContent = pick;
  splashText.style.setProperty('--hero-splash-tilt', `${tilt}deg`);
}

const COMMENT_KEY = 'mmc_comments_v1';
const COMMENT_API_STORAGE_KEY = 'mmc_comment_api_base';
const commentForm = document.querySelector('[data-comment-form]');
const commentList = document.querySelector('[data-comment-list]');
const commentClear = document.querySelector('[data-comment-clear]');
const commentSearch = document.querySelector('[data-comment-search]');
const commentStatus = document.querySelector('[data-comment-status]');

function getCommentApiBase() {
  const meta = document.querySelector('meta[name="comment-api-base"]');
  const metaValue = meta ? String(meta.getAttribute('content') || '').trim() : '';
  const globalValue = typeof window.COMMENT_API_BASE === 'string' ? window.COMMENT_API_BASE.trim() : '';
  const configuredValue = globalValue || metaValue;

  try {
    if (configuredValue) {
      window.localStorage.setItem(COMMENT_API_STORAGE_KEY, configuredValue);
      return configuredValue;
    }

    return String(window.localStorage.getItem(COMMENT_API_STORAGE_KEY) || '').trim();
  } catch {
    return configuredValue || '';
  }
}

const COMMENT_API_BASE = getCommentApiBase();
const COMMENT_MODE = COMMENT_API_BASE ? 'remote' : 'local';
let commentCache = [];
let commentCacheLoaded = false;

function getCommentListLimit() {
  if (!commentList) return Number.POSITIVE_INFINITY;
  const raw = String(commentList.dataset.commentLimit || '').trim().toLowerCase();
  if (!raw || raw === 'all') return Number.POSITIVE_INFINITY;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
}

function getCommentKeyword() {
  return commentSearch ? String(commentSearch.value || '').trim() : '';
}

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

async function loadCommentsRemote(limit = 80) {
  const url = new URL('/comments', COMMENT_API_BASE);
  url.searchParams.set('limit', String(limit));
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

  if (commentStatus) {
    commentStatus.textContent = message;
  }
}

function getFilteredComments(comments) {
  const keyword = getCommentKeyword();
  const normalizedKeyword = keyword.toLowerCase();
  const matched = normalizedKeyword
    ? comments.filter((item) => {
        const name = String(item.name || '').toLowerCase();
        const message = String(item.message || '').toLowerCase();
        return name.includes(normalizedKeyword) || message.includes(normalizedKeyword);
      })
    : comments.slice();
  const matchedCount = matched.length;
  const limit = getCommentListLimit();
  const items = Number.isFinite(limit) ? matched.slice(0, limit) : matched;

  return {
    items,
    keyword,
    matchedCount,
    totalCount: comments.length,
  };
}

function updateCommentStatus({ keyword, matchedCount, totalCount, shownCount }) {
  if (!commentStatus) return;

  if (keyword) {
    commentStatus.textContent = shownCount > 0
      ? `找到 ${matchedCount} 条相关留言，当前展示 ${shownCount} 条。`
      : `没有找到包含“${keyword}”的留言。`;
    return;
  }

  if (shownCount === 0) {
    commentStatus.textContent = '暂无留言，来写第一条吧。';
    return;
  }

  commentStatus.textContent = shownCount < totalCount
    ? `共 ${totalCount} 条留言，当前展示最新 ${shownCount} 条。`
    : `共 ${shownCount} 条留言。`;
}

function renderCommentsFromCache() {
  if (!commentList) return;
  commentList.innerHTML = '';

  const { items, keyword, matchedCount, totalCount } = getFilteredComments(commentCache);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'message-empty';
    empty.textContent = keyword
      ? `没有找到包含“${keyword}”的留言。`
      : '暂无留言，来写第一条吧。';
    commentList.appendChild(empty);
    updateCommentStatus({ keyword, matchedCount, totalCount, shownCount: 0 });
    return;
  }

  for (const item of items) {
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

  updateCommentStatus({
    keyword,
    matchedCount,
    totalCount,
    shownCount: items.length,
  });
}

async function renderComments(forceReload = false) {
  if (!commentList) return;

  if (commentStatus && (!commentCacheLoaded || forceReload)) {
    commentStatus.textContent = '正在加载留言...';
  }

  if (!commentCacheLoaded || forceReload) {
    try {
      const remoteLimit = Number.isFinite(getCommentListLimit()) ? 80 : 500;
      commentCache = COMMENT_MODE === 'remote'
        ? await loadCommentsRemote(remoteLimit)
        : loadCommentsLocal();
      commentCacheLoaded = true;
    } catch (error) {
      renderCommentsError(error instanceof Error ? error.message : '加载留言失败');
      return;
    }
  }

  renderCommentsFromCache();
}

if (commentList) {
  renderComments();

  if (commentClear) {
    if (COMMENT_MODE === 'remote') {
      commentClear.textContent = '刷新留言';
    }
  }

  if (commentForm) {
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
          renderComments(true);
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
      commentCache = loadCommentsLocal();
      commentCacheLoaded = true;
      renderCommentsFromCache();
    });
  }

  if (commentClear) {
    commentClear.addEventListener('click', () => {
      if (COMMENT_MODE === 'remote') {
        renderComments(true);
        return;
      }
      const ok = window.confirm('确定清空当前浏览器中的所有留言吗？');
      if (!ok) return;
      window.localStorage.removeItem(COMMENT_KEY);
      commentCache = [];
      commentCacheLoaded = true;
      renderCommentsFromCache();
    });
  }

  if (commentSearch) {
    commentSearch.addEventListener('input', () => {
      if (!commentCacheLoaded) {
        renderComments();
        return;
      }
      renderCommentsFromCache();
    });
  }
}

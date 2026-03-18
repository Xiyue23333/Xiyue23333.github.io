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
const REPLY_PAGE_SIZE = 10;
const LOCAL_COMMENT_CAP = 500;
const commentForm = document.querySelector('[data-comment-form]');
const commentList = document.querySelector('[data-comment-list]');
const commentClear = document.querySelector('[data-comment-clear]');
const commentSearch = document.querySelector('[data-comment-search]');
const commentStatus = document.querySelector('[data-comment-status]');
const commentThreadState = new Map();

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

function createLocalCommentId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toValidIsoString(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeClientComment(record, index = 0) {
  const normalized = {
    id: String(record?.id || `legacy-${index + 1}-${createLocalCommentId()}`),
    parentId: record?.parentId === null || record?.parentId === undefined || record?.parentId === ''
      ? null
      : String(record.parentId),
    name: String(record?.name || '').trim().slice(0, 24),
    message: String(record?.message || '').trim().slice(0, 280),
    likeCount: Math.max(0, Number.parseInt(String(record?.likeCount ?? 0), 10) || 0),
    createdAt: toValidIsoString(record?.createdAt),
  };

  return normalized;
}

function formatCommentTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '未知时间'
    : date.toLocaleString('zh-CN', { hour12: false });
}

function compareByCreatedDesc(a, b) {
  const timeA = new Date(a.createdAt).getTime();
  const timeB = new Date(b.createdAt).getTime();
  return timeB - timeA;
}

function compareRepliesForRank(a, b) {
  if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
  return compareByCreatedDesc(a, b);
}

function getThreadUiState(rootId) {
  const key = String(rootId);
  if (!commentThreadState.has(key)) {
    commentThreadState.set(key, { expanded: false, page: 1, replying: false });
  }
  return commentThreadState.get(key);
}

function matchesKeyword(comment, normalizedKeyword) {
  const name = String(comment.name || '').toLowerCase();
  const message = String(comment.message || '').toLowerCase();
  return name.includes(normalizedKeyword) || message.includes(normalizedKeyword);
}

function loadCommentsLocal() {
  try {
    const raw = window.localStorage.getItem(COMMENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    let changed = false;
    const normalized = list
      .map((item, index) => {
        const next = normalizeClientComment(item, index);
        if (
          !item
          || String(item.id || '') !== next.id
          || String(item.parentId ?? '') !== String(next.parentId ?? '')
          || String(item.name || '') !== next.name
          || String(item.message || '') !== next.message
          || Number.parseInt(String(item.likeCount ?? 0), 10) !== next.likeCount
          || String(item.createdAt || '') !== next.createdAt
        ) {
          changed = true;
        }
        return next;
      })
      .filter((item) => item.name && item.message);

    if (changed) {
      saveCommentsLocal(normalized);
    }

    return normalized;
  } catch {
    return [];
  }
}

function saveCommentsLocal(commentsOldestFirst) {
  window.localStorage.setItem(COMMENT_KEY, JSON.stringify(commentsOldestFirst));
}

async function loadCommentsRemote(limit = 500) {
  const url = new URL('/comments', COMMENT_API_BASE);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`加载留言失败（${res.status}）`);
  const data = await res.json();
  if (!data || data.ok !== true || !Array.isArray(data.comments)) return [];
  return data.comments.map((item, index) => normalizeClientComment(item, index));
}

async function postCommentRemote(name, message, parentId = null) {
  const url = new URL('/comments', COMMENT_API_BASE);
  const payload = { name, message };
  if (parentId) payload.parentId = parentId;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`发布失败（${res.status}）`);
  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true || !data.comment) throw new Error('发布失败（服务返回异常）');
  return normalizeClientComment(data.comment);
}

async function likeCommentRemote(commentId) {
  const url = new URL(`/comments/${encodeURIComponent(commentId)}/like`, COMMENT_API_BASE);
  const res = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`点赞失败（${res.status}）`);
  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true || !data.comment) throw new Error('点赞失败（服务返回异常）');
  return Math.max(0, Number.parseInt(String(data.comment.likeCount ?? 0), 10) || 0);
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

function buildThreads(comments) {
  const byId = new Map();
  const roots = [];

  for (const item of comments) {
    const normalized = {
      ...normalizeClientComment(item),
      replies: [],
    };
    byId.set(normalized.id, normalized);
  }

  for (const item of byId.values()) {
    if (item.parentId && byId.has(item.parentId) && !byId.get(item.parentId).parentId) {
      byId.get(item.parentId).replies.push(item);
    } else {
      roots.push(item);
    }
  }

  roots.sort(compareByCreatedDesc);
  for (const root of roots) {
    root.replies.sort(compareRepliesForRank);
  }

  return roots;
}

function getFilteredThreads(comments) {
  const keyword = getCommentKeyword();
  const allThreads = buildThreads(comments);
  const normalizedKeyword = keyword.toLowerCase();
  const matchedThreads = normalizedKeyword
    ? allThreads.filter((thread) => (
        matchesKeyword(thread, normalizedKeyword)
        || thread.replies.some((reply) => matchesKeyword(reply, normalizedKeyword))
      ))
    : allThreads.slice();
  const limit = getCommentListLimit();
  const items = Number.isFinite(limit) ? matchedThreads.slice(0, limit) : matchedThreads;

  return {
    items,
    keyword,
    matchedCount: matchedThreads.length,
    totalCount: allThreads.length,
  };
}

function updateCommentStatus({ keyword, matchedCount, totalCount, shownCount }) {
  if (!commentStatus) return;

  if (keyword) {
    commentStatus.textContent = shownCount > 0
      ? `找到 ${matchedCount} 条相关主留言，当前展示 ${shownCount} 条。`
      : `没有找到包含“${keyword}”的留言。`;
    return;
  }

  if (shownCount === 0) {
    commentStatus.textContent = '暂无留言，来写第一条吧。';
    return;
  }

  commentStatus.textContent = shownCount < totalCount
    ? `共 ${totalCount} 条主留言，当前展示最新 ${shownCount} 条。`
    : `共 ${shownCount} 条主留言。`;
}

function createActionButton({ text, action, commentId, className = 'message-action-btn', type = 'button' }) {
  const button = document.createElement('button');
  button.type = type;
  button.className = className;
  button.dataset.commentAction = action;
  if (commentId) {
    button.dataset.commentId = String(commentId);
  }
  button.textContent = text;
  return button;
}

function renderReplyItem(reply) {
  const item = document.createElement('article');
  item.className = 'message-reply';

  const head = document.createElement('div');
  head.className = 'message-reply-head';

  const name = document.createElement('strong');
  name.textContent = reply.name;

  const time = document.createElement('span');
  time.textContent = formatCommentTime(reply.createdAt);

  head.appendChild(name);
  head.appendChild(time);

  const body = document.createElement('p');
  body.textContent = reply.message;

  const actions = document.createElement('div');
  actions.className = 'message-reply-actions';

  const likeButton = createActionButton({
    text: `点赞 ${reply.likeCount}`,
    action: 'like-reply',
    commentId: reply.id,
    className: 'message-action-btn message-like-btn',
  });

  actions.appendChild(likeButton);
  item.appendChild(head);
  item.appendChild(body);
  item.appendChild(actions);
  return item;
}

function renderReplyForm(rootId) {
  const form = document.createElement('form');
  form.className = 'message-reply-form';
  form.dataset.commentReplyForm = 'true';
  form.dataset.parentId = String(rootId);

  const nameLabel = document.createElement('label');
  nameLabel.textContent = '昵称';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.name = 'name';
  nameInput.maxLength = 24;
  nameInput.placeholder = '输入昵称';
  nameInput.required = true;
  nameLabel.appendChild(nameInput);

  const messageLabel = document.createElement('label');
  messageLabel.textContent = '回复内容';
  const messageInput = document.createElement('textarea');
  messageInput.name = 'message';
  messageInput.maxLength = 280;
  messageInput.rows = 3;
  messageInput.placeholder = '输入你要回复的内容...';
  messageInput.required = true;
  messageLabel.appendChild(messageInput);

  const actions = document.createElement('div');
  actions.className = 'message-actions message-reply-actions-row';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn-primary';
  submit.textContent = '提交回复';

  const cancel = createActionButton({
    text: '取消',
    action: 'cancel-reply',
    commentId: rootId,
    className: 'btn btn-outline',
  });

  actions.appendChild(submit);
  actions.appendChild(cancel);
  form.appendChild(nameLabel);
  form.appendChild(messageLabel);
  form.appendChild(actions);
  return form;
}

function renderThread(thread) {
  const state = getThreadUiState(thread.id);
  const card = document.createElement('article');
  card.className = 'message-item message-thread';

  const head = document.createElement('div');
  head.className = 'message-item-head';

  const name = document.createElement('strong');
  name.textContent = thread.name;

  const time = document.createElement('span');
  time.textContent = formatCommentTime(thread.createdAt);

  head.appendChild(name);
  head.appendChild(time);

  const body = document.createElement('p');
  body.textContent = thread.message;

  card.appendChild(head);
  card.appendChild(body);

  if (thread.replies.length > 0 && !state.expanded) {
    const preview = document.createElement('div');
    preview.className = 'message-thread-preview';
    for (const reply of thread.replies.slice(0, 2)) {
      preview.appendChild(renderReplyItem(reply));
    }
    card.appendChild(preview);
  }

  const footer = document.createElement('div');
  footer.className = 'message-thread-footer';

  const meta = document.createElement('p');
  meta.className = 'message-thread-meta';
  meta.textContent = thread.replies.length > 0 ? `回复 ${thread.replies.length}` : '暂无回复';

  const replyButton = createActionButton({
    text: state.replying ? '收起回复' : '回复',
    action: 'reply-toggle',
    commentId: thread.id,
    className: 'message-action-btn message-reply-toggle',
  });

  footer.appendChild(meta);
  footer.appendChild(replyButton);
  card.appendChild(footer);

  if (state.replying) {
    card.appendChild(renderReplyForm(thread.id));
  }

  if (thread.replies.length > 2) {
    const toggle = createActionButton({
      text: state.expanded ? '收起留言 ▴' : '展开更多留言 ▾',
      action: 'toggle-replies',
      commentId: thread.id,
      className: 'message-thread-toggle',
    });
    card.appendChild(toggle);
  }

  if (thread.replies.length > 0 && state.expanded) {
    const expanded = document.createElement('div');
    expanded.className = 'message-thread-expanded';

    const totalPages = Math.max(1, Math.ceil(thread.replies.length / REPLY_PAGE_SIZE));
    const currentPage = Math.min(Math.max(state.page, 1), totalPages);
    state.page = currentPage;
    const start = (currentPage - 1) * REPLY_PAGE_SIZE;
    const pageItems = thread.replies.slice(start, start + REPLY_PAGE_SIZE);

    const list = document.createElement('div');
    list.className = 'message-thread-list';
    for (const reply of pageItems) {
      list.appendChild(renderReplyItem(reply));
    }

    expanded.appendChild(list);

    if (totalPages > 1) {
      const pagination = document.createElement('div');
      pagination.className = 'message-pagination';

      const prev = createActionButton({
        text: '上一页',
        action: 'replies-page',
        commentId: thread.id,
        className: 'message-action-btn',
      });
      prev.dataset.page = String(currentPage - 1);
      prev.disabled = currentPage <= 1;

      const next = createActionButton({
        text: '下一页',
        action: 'replies-page',
        commentId: thread.id,
        className: 'message-action-btn',
      });
      next.dataset.page = String(currentPage + 1);
      next.disabled = currentPage >= totalPages;

      const pageInfo = document.createElement('span');
      pageInfo.className = 'message-page-info';
      pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;

      pagination.appendChild(prev);
      pagination.appendChild(next);
      pagination.appendChild(pageInfo);
      expanded.appendChild(pagination);
    }

    card.appendChild(expanded);
  }

  return card;
}

function renderCommentsFromCache() {
  if (!commentList) return;
  commentList.innerHTML = '';

  const { items, keyword, matchedCount, totalCount } = getFilteredThreads(commentCache);

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

  for (const thread of items) {
    commentList.appendChild(renderThread(thread));
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
      commentCache = COMMENT_MODE === 'remote'
        ? await loadCommentsRemote(500)
        : loadCommentsLocal();
      commentCacheLoaded = true;
    } catch (error) {
      renderCommentsError(error instanceof Error ? error.message : '加载留言失败');
      return;
    }
  }

  renderCommentsFromCache();
}

async function createComment(name, message, parentId = null) {
  const safeName = String(name || '').trim().slice(0, 24);
  const safeMessage = String(message || '').trim().slice(0, 280);
  const safeParentId = parentId ? String(parentId) : null;
  if (!safeName || !safeMessage) return;

  if (COMMENT_MODE === 'remote') {
    await postCommentRemote(safeName, safeMessage, safeParentId);
    await renderComments(true);
    return;
  }

  const commentsOldestFirst = loadCommentsLocal();
  commentsOldestFirst.push({
    id: createLocalCommentId(),
    parentId: safeParentId,
    name: safeName,
    message: safeMessage,
    likeCount: 0,
    createdAt: new Date().toISOString(),
  });
  const capped = commentsOldestFirst.slice(-LOCAL_COMMENT_CAP);
  saveCommentsLocal(capped);
  commentCache = capped;
  commentCacheLoaded = true;
  renderCommentsFromCache();
}

async function likeComment(commentId) {
  const targetId = String(commentId);

  if (COMMENT_MODE === 'remote') {
    const nextLikeCount = await likeCommentRemote(targetId);
    commentCache = commentCache.map((item) => (
      String(item.id) === targetId ? { ...item, likeCount: nextLikeCount } : item
    ));
    commentCacheLoaded = true;
    renderCommentsFromCache();
    return;
  }

  const commentsOldestFirst = loadCommentsLocal();
  const updated = commentsOldestFirst.map((item) => (
    String(item.id) === targetId
      ? { ...item, likeCount: Math.max(0, Number.parseInt(String(item.likeCount ?? 0), 10) || 0) + 1 }
      : item
  ));
  saveCommentsLocal(updated);
  commentCache = updated;
  commentCacheLoaded = true;
  renderCommentsFromCache();
}

if (commentList) {
  renderComments();

  if (commentClear && COMMENT_MODE === 'remote') {
    commentClear.textContent = '刷新留言';
  }

  if (commentForm) {
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(commentForm);
      const name = String(formData.get('name') || '').trim();
      const message = String(formData.get('message') || '').trim();
      if (!name || !message) return;

      try {
        await createComment(name, message, null);
        commentForm.reset();
      } catch (error) {
        renderCommentsError(error instanceof Error ? error.message : '发布失败');
      }
    });
  }

  commentList.addEventListener('click', async (event) => {
    const actionButton = event.target instanceof Element
      ? event.target.closest('[data-comment-action]')
      : null;
    if (!(actionButton instanceof HTMLButtonElement)) return;

    const action = String(actionButton.dataset.commentAction || '');
    const commentId = String(actionButton.dataset.commentId || '');
    if (!action || !commentId) return;

    const state = getThreadUiState(commentId);

    try {
      if (action === 'reply-toggle') {
        state.replying = !state.replying;
        renderCommentsFromCache();
        return;
      }

      if (action === 'cancel-reply') {
        state.replying = false;
        renderCommentsFromCache();
        return;
      }

      if (action === 'toggle-replies') {
        state.expanded = !state.expanded;
        state.page = 1;
        renderCommentsFromCache();
        return;
      }

      if (action === 'replies-page') {
        const nextPage = Number.parseInt(String(actionButton.dataset.page || ''), 10);
        if (Number.isFinite(nextPage) && nextPage > 0) {
          state.page = nextPage;
          state.expanded = true;
          renderCommentsFromCache();
        }
        return;
      }

      if (action === 'like-reply') {
        await likeComment(commentId);
      }
    } catch (error) {
      renderCommentsError(error instanceof Error ? error.message : '操作失败');
    }
  });

  commentList.addEventListener('submit', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.hasAttribute('data-comment-reply-form')) return;

    event.preventDefault();
    const formData = new FormData(target);
    const name = String(formData.get('name') || '').trim();
    const message = String(formData.get('message') || '').trim();
    const parentId = String(target.dataset.parentId || '');
    if (!name || !message || !parentId) return;

    try {
      await createComment(name, message, parentId);
      getThreadUiState(parentId).replying = false;
      renderCommentsFromCache();
    } catch (error) {
      renderCommentsError(error instanceof Error ? error.message : '回复失败');
    }
  });

  if (commentClear) {
    commentClear.addEventListener('click', () => {
      if (COMMENT_MODE === 'remote') {
        renderComments(true);
        return;
      }
      const ok = window.confirm('确定清空当前浏览器中的所有留言与回复吗？');
      if (!ok) return;
      window.localStorage.removeItem(COMMENT_KEY);
      commentCache = [];
      commentCacheLoaded = true;
      commentThreadState.clear();
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

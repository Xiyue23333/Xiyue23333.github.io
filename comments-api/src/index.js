function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

function parseAllowedOrigins(env) {
  const raw = String(env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return null;
  const set = new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return set.size ? set : null;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = parseAllowedOrigins(env);
  const allowOrigin = allowed
    ? (allowed.has(origin) ? origin : '')
    : (origin || '*');

  const headers = new Headers();
  if (allowOrigin) headers.set('access-control-allow-origin', allowOrigin);
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('access-control-max-age', '86400');
  headers.set('vary', 'origin');
  return headers;
}

function withCors(response, request, env) {
  const headers = corsHeaders(request, env);
  const merged = new Headers(response.headers);
  for (const [key, value] of headers.entries()) merged.set(key, value);
  return new Response(response.body, { status: response.status, headers: merged });
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeText(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen);
}

function parseCommentId(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return withCors(jsonResponse({ ok: true, service: 'mmc-comments' }), request, env);
    }

    const commentMatch = url.pathname.match(/^\/comments\/(\d+)\/like$/);

    if (commentMatch && request.method === 'POST') {
      const commentId = parseCommentId(commentMatch[1]);
      if (!commentId) {
        return withCors(
          jsonResponse({ ok: false, error: 'invalid_comment_id' }, { status: 400 }),
          request,
          env,
        );
      }

      const result = await env.DB
        .prepare('UPDATE comments SET like_count = like_count + 1 WHERE id = ?')
        .bind(commentId)
        .run();

      if (!result?.success || !result?.meta?.changes) {
        return withCors(
          jsonResponse({ ok: false, error: 'comment_not_found' }, { status: 404 }),
          request,
          env,
        );
      }

      const row = await env.DB
        .prepare('SELECT id, like_count FROM comments WHERE id = ?')
        .bind(commentId)
        .first();

      return withCors(
        jsonResponse({
          ok: true,
          comment: {
            id: row?.id ?? commentId,
            likeCount: row?.like_count ?? 0,
          },
        }),
        request,
        env,
      );
    }

    if (url.pathname !== '/comments') {
      return withCors(jsonResponse({ ok: false, error: 'not_found' }, { status: 404 }), request, env);
    }

    if (request.method === 'GET') {
      const limit = clampInt(url.searchParams.get('limit'), 1, 500, 120);
      const { results } = await env.DB
        .prepare('SELECT id, parent_id, name, message, like_count, created_at FROM comments ORDER BY id DESC LIMIT ?')
        .bind(limit)
        .all();

      const comments = (results || []).map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        message: row.message,
        likeCount: row.like_count ?? 0,
        createdAt: row.created_at,
      }));

      return withCors(jsonResponse({ ok: true, comments }), request, env);
    }

    if (request.method === 'POST') {
      let body = null;
      try {
        body = await request.json();
      } catch {
        body = null;
      }

      const name = normalizeText(body?.name, 24);
      const message = normalizeText(body?.message, 280);
      const parentId = parseCommentId(body?.parentId);

      if (!name || !message) {
        return withCors(
          jsonResponse({ ok: false, error: 'invalid_input' }, { status: 400 }),
          request,
          env,
        );
      }

      if (parentId) {
        const parent = await env.DB
          .prepare('SELECT id, parent_id FROM comments WHERE id = ?')
          .bind(parentId)
          .first();

        if (!parent) {
          return withCors(
            jsonResponse({ ok: false, error: 'parent_not_found' }, { status: 400 }),
            request,
            env,
          );
        }

        if (parent.parent_id !== null && parent.parent_id !== undefined) {
          return withCors(
            jsonResponse({ ok: false, error: 'nested_reply_not_allowed' }, { status: 400 }),
            request,
            env,
          );
        }
      }

      const now = new Date().toISOString();
      const result = await env.DB
        .prepare('INSERT INTO comments (parent_id, name, message, like_count, created_at) VALUES (?, ?, ?, 0, ?)')
        .bind(parentId, name, message, now)
        .run();

      return withCors(
        jsonResponse({
          ok: true,
          comment: {
            id: result?.meta?.last_row_id ?? null,
            parentId,
            name,
            message,
            likeCount: 0,
            createdAt: now,
          },
        }),
        request,
        env,
      );
    }

    return withCors(
      jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 }),
      request,
      env,
    );
  },
};

(function () {
  const viewers = document.querySelectorAll('[data-ide-viewer]');

  if (!viewers.length) return;

  const KEYWORDS = {
    java: [
      'package', 'import', 'public', 'private', 'protected', 'class', 'interface', 'enum',
      'extends', 'implements', 'static', 'final', 'void', 'new', 'return', 'if', 'else',
      'switch', 'case', 'default', 'for', 'while', 'do', 'break', 'continue', 'try', 'catch',
      'finally', 'throw', 'throws', 'this', 'super', 'true', 'false', 'null'
    ],
    gradle: [
      'plugins', 'id', 'version', 'group', 'repositories', 'dependencies', 'minecraft',
      'implementation', 'compileOnly', 'runtimeOnly', 'task', 'tasks', 'register', 'mappings'
    ],
    properties: ['true', 'false'],
    toml: ['true', 'false'],
    json: ['true', 'false', 'null']
  };

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function detectLang(file) {
    const lower = file.toLowerCase();
    if (lower.endsWith('.java')) return 'java';
    if (lower.endsWith('.gradle')) return 'gradle';
    if (lower.endsWith('.properties')) return 'properties';
    if (lower.endsWith('.toml')) return 'toml';
    if (lower.endsWith('.json')) return 'json';
    return 'plain';
  }

  function highlightCode(raw, fileName) {
    let text = raw.replace(/\r\n/g, '\n');
    const lang = detectLang(fileName);
    const tokens = [];

    function stashRaw(regex, className) {
      text = text.replace(regex, (match) => {
        const id = tokens.push(`<span class="${className}">${escapeHtml(match)}</span>`) - 1;
        return `__TOK_${id}__`;
      });
    }

    function stashEscaped(regex, className) {
      text = text.replace(regex, (match) => {
        const id = tokens.push(`<span class="${className}">${match}</span>`) - 1;
        return `__TOK_${id}__`;
      });
    }

    stashRaw(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, 'tok-string');
    stashRaw(/\/\*[\s\S]*?\*\//g, 'tok-comment');
    stashRaw(/\/\/[^\n]*/g, 'tok-comment');
    stashRaw(/#[^\n]*/g, 'tok-comment');

    text = escapeHtml(text);

    const keywords = KEYWORDS[lang] || [];
    if (keywords.length > 0) {
      const pattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
      stashEscaped(pattern, 'tok-keyword');
    }

    stashEscaped(/\b(\d+(?:\.\d+)?)\b/g, 'tok-number');
    stashEscaped(/(@[A-Za-z_][A-Za-z0-9_]*)/g, 'tok-anno');
    stashEscaped(/([=+\-*/%<>!&|?:]+)/g, 'tok-operator');

    text = text.replace(/[{}()[\]]/g, (char) => {
      const map = {
        '{': 'tok-brace',
        '}': 'tok-brace',
        '(': 'tok-paren',
        ')': 'tok-paren',
        '[': 'tok-square',
        ']': 'tok-square'
      };
      const id = tokens.push(`<span class="tok-bracket ${map[char]}">${char}</span>`) - 1;
      return `__TOK_${id}__`;
    });

    return text.replace(/__TOK_(\d+)__/g, (_, i) => tokens[Number(i)] || '');
  }

  function buildTree(files) {
    const root = { folders: new Map(), files: [] };

    files.forEach((file, index) => {
      const parts = file.path.split('/').filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        if (!node.folders.has(part)) {
          node.folders.set(part, { folders: new Map(), files: [] });
        }
        node = node.folders.get(part);
      }
      node.files.push({ name: parts[parts.length - 1], index });
    });

    return root;
  }

  function renderTree(node, container, depth, onOpen) {
    const folderEntries = Array.from(node.folders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    folderEntries.forEach(([name, folder]) => {
      const details = document.createElement('details');
      details.className = 'viewer-folder';
      if (depth < 1) details.open = true;

      const summary = document.createElement('summary');
      summary.style.setProperty('--indent', `${depth * 14}px`);
      summary.textContent = name;
      details.appendChild(summary);

      const children = document.createElement('div');
      children.className = 'viewer-folder-children';
      renderTree(folder, children, depth + 1, onOpen);
      details.appendChild(children);

      container.appendChild(details);
    });

    node.files.sort((a, b) => a.name.localeCompare(b.name)).forEach((file) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'viewer-file';
      btn.dataset.index = String(file.index);
      btn.style.setProperty('--indent', `${depth * 14 + 10}px`);
      btn.textContent = file.name;
      btn.addEventListener('click', () => onOpen(file.index));
      container.appendChild(btn);
    });
  }

  viewers.forEach((viewer) => {
    const scripts = Array.from(viewer.querySelectorAll('script[data-file]'));
    if (!scripts.length) return;

    const files = scripts.map((s) => ({
      path: s.dataset.file || 'unknown.txt',
      code: (s.textContent || '').replace(/\r\n/g, '\n').trimEnd()
    }));

    scripts.forEach((s) => s.remove());

    const treeEl = viewer.querySelector('.viewer-tree');
    const tabEl = viewer.querySelector('.viewer-tab');
    const linesEl = viewer.querySelector('.viewer-lines');
    const codeEl = viewer.querySelector('.viewer-code');
    const scrollEl = viewer.querySelector('.viewer-code-scroll');
    const pathEl = viewer.querySelector('.viewer-path');

    if (!treeEl || !tabEl || !linesEl || !codeEl || !scrollEl || !pathEl) return;

    const state = { active: 0 };

    function renderLines(code) {
      const count = Math.max(1, code.split('\n').length);
      let out = '';
      for (let i = 1; i <= count; i += 1) out += `<span>${i}</span>`;
      linesEl.innerHTML = out;
      linesEl.scrollTop = scrollEl.scrollTop;
    }

    function setActive(index) {
      const file = files[index];
      if (!file) return;
      state.active = index;
      tabEl.textContent = file.path.split('/').pop();
      pathEl.textContent = file.path;
      codeEl.innerHTML = `${highlightCode(file.code, file.path)}\n`;
      renderLines(file.code);

      treeEl.querySelectorAll('.viewer-file').forEach((el) => {
        el.classList.toggle('active', Number(el.dataset.index) === index);
      });
    }

    treeEl.innerHTML = '';
    const treeRoot = document.createElement('div');
    treeRoot.className = 'viewer-tree-root';
    renderTree(buildTree(files), treeRoot, 0, setActive);
    treeEl.appendChild(treeRoot);

    scrollEl.addEventListener('scroll', () => {
      linesEl.scrollTop = scrollEl.scrollTop;
    });

    setActive(0);
  });
})();

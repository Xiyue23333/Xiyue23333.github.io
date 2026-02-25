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
    if (keywords.length) {
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

  function buildModel(files) {
    const root = { folders: new Map(), files: [] };

    files.forEach((file, index) => {
      const parts = file.path.split('/').filter(Boolean);
      if (!parts.length) return;

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

  function renderTreeNode(node, container, depth, onOpenFile) {
    const folders = Array.from(node.folders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const files = node.files.slice().sort((a, b) => a.name.localeCompare(b.name));

    folders.forEach(([name, child]) => {
      const group = document.createElement('div');
      group.className = 'viewer-folder-group';

      const folderRow = document.createElement('button');
      folderRow.type = 'button';
      folderRow.className = 'viewer-node viewer-folder-row';
      folderRow.style.setProperty('--indent', `${depth * 14}px`);
      folderRow.innerHTML = `<span class="viewer-caret">▾</span><span class="viewer-label">${name}</span>`;

      const children = document.createElement('div');
      children.className = 'viewer-children';
      renderTreeNode(child, children, depth + 1, onOpenFile);

      const openByDefault = depth < 1;
      folderRow.classList.toggle('closed', !openByDefault);
      children.hidden = !openByDefault;

      folderRow.addEventListener('click', () => {
        const isClosed = folderRow.classList.toggle('closed');
        children.hidden = isClosed;
      });

      group.appendChild(folderRow);
      group.appendChild(children);
      container.appendChild(group);
    });

    files.forEach((file) => {
      const fileRow = document.createElement('button');
      fileRow.type = 'button';
      fileRow.className = 'viewer-node viewer-file-row';
      fileRow.dataset.index = String(file.index);
      fileRow.style.setProperty('--indent', `${depth * 14 + 10}px`);
      fileRow.innerHTML = `<span class="viewer-file-dot">•</span><span class="viewer-label">${file.name}</span>`;
      fileRow.addEventListener('click', () => onOpenFile(file.index));
      container.appendChild(fileRow);
    });
  }

  viewers.forEach((viewer) => {
    const templateScripts = Array.from(viewer.querySelectorAll('script[data-file]'));
    if (!templateScripts.length) return;

    const files = templateScripts.map((script) => ({
      path: script.dataset.file || 'unknown.txt',
      code: (script.textContent || '').replace(/\r\n/g, '\n').trimEnd()
    }));

    templateScripts.forEach((script) => script.remove());

    const tree = viewer.querySelector('.viewer-tree');
    const tab = viewer.querySelector('.viewer-tab');
    const lines = viewer.querySelector('.viewer-lines');
    const code = viewer.querySelector('.viewer-code');
    const codeScroll = viewer.querySelector('.viewer-code-scroll');
    const path = viewer.querySelector('.viewer-path');

    if (!tree || !tab || !lines || !code || !codeScroll || !path) return;

    function renderLineNumbers(content) {
      const count = Math.max(1, content.split('\n').length);
      let html = '';
      for (let i = 1; i <= count; i += 1) {
        html += `<div>${i}</div>`;
      }
      lines.innerHTML = html;
      lines.scrollTop = codeScroll.scrollTop;
    }

    function openFile(index) {
      const file = files[index];
      if (!file) return;

      tab.textContent = file.path.split('/').pop();
      path.textContent = file.path;
      code.innerHTML = `${highlightCode(file.code, file.path)}\n`;
      renderLineNumbers(file.code);

      tree.querySelectorAll('.viewer-file-row').forEach((row) => {
        row.classList.toggle('active', Number(row.dataset.index) === index);
      });
    }

    tree.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'viewer-tree-root';
    renderTreeNode(buildModel(files), root, 0, openFile);
    tree.appendChild(root);

    codeScroll.addEventListener('scroll', () => {
      lines.scrollTop = codeScroll.scrollTop;
    });

    openFile(0);
  });
})();

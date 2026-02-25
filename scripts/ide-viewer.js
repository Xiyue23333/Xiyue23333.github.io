(function () {
  const viewers = document.querySelectorAll("[data-ide-viewer]");
  if (!viewers.length) return;

  const KEYWORDS = {
    java: [
      "package", "import", "public", "private", "protected", "class", "interface", "enum",
      "extends", "implements", "static", "final", "void", "new", "return", "if", "else",
      "switch", "case", "default", "for", "while", "do", "break", "continue", "try", "catch",
      "finally", "throw", "throws", "this", "super", "true", "false", "null"
    ],
    gradle: [
      "plugins", "id", "version", "group", "repositories", "dependencies", "minecraft",
      "implementation", "compileOnly", "runtimeOnly", "task", "tasks", "register", "mappings"
    ],
    properties: ["true", "false"],
    toml: ["true", "false"],
    json: ["true", "false", "null"]
  };

  const MODIFIED_RULES = [
    {
      file: /settings\.gradle$/i,
      includes: ["maven { url = 'https://maven.parchmentmc.org' }"]
    },
    {
      file: /build\.gradle$/i,
      includes: ["id 'org.parchmentmc.librarian.forgegradle' version '1.+'"]
    },
    {
      file: /gradle\.properties$/i,
      includes: [
        "mapping_channel=parchment",
        "mapping_version=2023.09.03-1.20.1",
        "mod_id=tutorial",
        "mod_group_id=com.xiyue.tutorial"
      ]
    },
    {
      file: /TutorialMod\.java$/i,
      includes: ["public static final String MODID = \"tutorial\";"]
    }
  ];

  const OPEN_TO_CLOSE = {
    "(": ")",
    "[": "]",
    "{": "}"
  };

  const CLOSE_TO_OPEN = {
    ")": "(",
    "]": "[",
    "}": "{"
  };

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function detectLang(filePath) {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".java")) return "java";
    if (lower.endsWith(".gradle")) return "gradle";
    if (lower.endsWith(".properties")) return "properties";
    if (lower.endsWith(".toml")) return "toml";
    if (lower.endsWith(".json")) return "json";
    return "plain";
  }

  function isWordStart(char) {
    return /[A-Za-z_]/.test(char);
  }

  function isWord(char) {
    return /[A-Za-z0-9_]/.test(char);
  }

  function isDigit(char) {
    return /[0-9]/.test(char);
  }

  function isOperator(char) {
    return /[=+\-*/%<>!&|?:.,]/.test(char);
  }

  function markRange(styles, start, end, tokenClass) {
    for (let i = start; i < end; i += 1) {
      if (styles[i] === "") styles[i] = tokenClass;
    }
  }

  function tokenize(text, lang) {
    const styles = new Array(text.length).fill("");
    const keywordSet = new Set(KEYWORDS[lang] || []);
    let i = 0;

    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1] || "";

      if (ch === "/" && next === "*") {
        const start = i;
        i += 2;
        while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
        i = Math.min(text.length, i + 2);
        markRange(styles, start, i, "tok-comment");
        continue;
      }

      if (ch === "/" && next === "/") {
        const start = i;
        i += 2;
        while (i < text.length && text[i] !== "\n") i += 1;
        markRange(styles, start, i, "tok-comment");
        continue;
      }

      if (ch === "#") {
        const start = i;
        i += 1;
        while (i < text.length && text[i] !== "\n") i += 1;
        markRange(styles, start, i, "tok-comment");
        continue;
      }

      if (ch === "\"" || ch === "'" || ch === "`") {
        const quote = ch;
        const start = i;
        i += 1;
        while (i < text.length) {
          if (text[i] === "\\") {
            i += 2;
            continue;
          }
          if (text[i] === quote) {
            i += 1;
            break;
          }
          i += 1;
        }
        markRange(styles, start, i, "tok-string");
        continue;
      }

      if (ch === "@" && isWordStart(next)) {
        const start = i;
        i += 2;
        while (i < text.length && isWord(text[i])) i += 1;
        markRange(styles, start, i, "tok-anno");
        continue;
      }

      if (isDigit(ch)) {
        const start = i;
        i += 1;
        while (i < text.length && /[0-9._]/.test(text[i])) i += 1;
        markRange(styles, start, i, "tok-number");
        continue;
      }

      if (isWordStart(ch)) {
        const start = i;
        i += 1;
        while (i < text.length && isWord(text[i])) i += 1;
        const word = text.slice(start, i);
        if (keywordSet.has(word)) {
          markRange(styles, start, i, "tok-keyword");
        }
        continue;
      }

      if (isOperator(ch)) {
        const start = i;
        i += 1;
        while (i < text.length && isOperator(text[i])) i += 1;
        markRange(styles, start, i, "tok-operator");
        continue;
      }

      if (ch === "{" || ch === "}") {
        styles[i] = "tok-brace";
        i += 1;
        continue;
      }

      if (ch === "(" || ch === ")") {
        styles[i] = "tok-paren";
        i += 1;
        continue;
      }

      if (ch === "[" || ch === "]") {
        styles[i] = "tok-square";
        i += 1;
        continue;
      }

      i += 1;
    }

    return styles;
  }

  function getModifiedPatterns(filePath) {
    const rule = MODIFIED_RULES.find((item) => item.file.test(filePath));
    return rule ? rule.includes : [];
  }

  function detectModifiedLines(filePath, code) {
    const patterns = getModifiedPatterns(filePath);
    const set = new Set();
    if (!patterns.length) return set;

    const rows = code.split("\n");
    rows.forEach((line, index) => {
      if (patterns.some((pattern) => line.includes(pattern))) {
        set.add(index + 1);
      }
    });
    return set;
  }

  function buildLineStarts(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "\n") starts.push(i + 1);
    }
    return starts;
  }

  function positionToLine(lineStarts, pos) {
    let left = 0;
    let right = lineStarts.length - 1;
    let answer = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (lineStarts[mid] <= pos) {
        answer = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return answer + 1;
  }

  function findBracketPair(text, caretPos) {
    const candidates = [caretPos - 1, caretPos];
    for (let i = 0; i < candidates.length; i += 1) {
      const pos = candidates[i];
      if (pos < 0 || pos >= text.length) continue;
      const ch = text[pos];

      if (OPEN_TO_CLOSE[ch]) {
        const close = OPEN_TO_CLOSE[ch];
        let depth = 0;
        for (let j = pos; j < text.length; j += 1) {
          if (text[j] === ch) depth += 1;
          if (text[j] === close) depth -= 1;
          if (depth === 0) return [pos, j];
        }
      }

      if (CLOSE_TO_OPEN[ch]) {
        const open = CLOSE_TO_OPEN[ch];
        let depth = 0;
        for (let j = pos; j >= 0; j -= 1) {
          if (text[j] === ch) depth += 1;
          if (text[j] === open) depth -= 1;
          if (depth === 0) return [j, pos];
        }
      }
    }
    return null;
  }

  function getCharClass(char, styleClass) {
    const classes = [];
    if (styleClass) classes.push(styleClass);
    if ("()[]{}".includes(char)) classes.push("tok-bracket");
    return classes;
  }

  function buildHighlightedLines(file, activeLine, bracketPair) {
    const rows = file.code.split("\n");
    const bracketSet = new Set(bracketPair || []);
    const html = [];
    let globalPos = 0;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const lineNumber = rowIndex + 1;
      const rowClasses = ["viewer-code-line"];
      if (lineNumber === activeLine) rowClasses.push("is-active");
      if (file.modifiedLines.has(lineNumber)) rowClasses.push("is-modified");

      const rowText = rows[rowIndex];
      let rowHtml = "";
      let currentClass = "";
      let buffer = "";

      for (let i = 0; i < rowText.length; i += 1) {
        const char = rowText[i];
        const classes = getCharClass(char, file.styles[globalPos]);
        if (bracketSet.has(globalPos)) classes.push("tok-bracket-match");
        const className = classes.join(" ");

        if (className !== currentClass) {
          if (buffer !== "") {
            rowHtml += currentClass
              ? `<span class="${currentClass}">${escapeHtml(buffer)}</span>`
              : escapeHtml(buffer);
          }
          currentClass = className;
          buffer = char;
        } else {
          buffer += char;
        }
        globalPos += 1;
      }

      if (buffer !== "") {
        rowHtml += currentClass
          ? `<span class="${currentClass}">${escapeHtml(buffer)}</span>`
          : escapeHtml(buffer);
      }

      if (rowHtml === "") rowHtml = "&nbsp;";
      html.push(`<div class="${rowClasses.join(" ")}">${rowHtml}</div>`);
      globalPos += 1;
    }

    return html.join("");
  }

  function buildLineNumbers(file, activeLine) {
    let html = "";
    for (let i = 1; i <= file.lineCount; i += 1) {
      const classes = ["viewer-line-num"];
      if (i === activeLine) classes.push("is-active");
      if (file.modifiedLines.has(i)) classes.push("is-modified");
      html += `<div class="${classes.join(" ")}">${i}</div>`;
    }
    return html;
  }

  function buildModel(files) {
    const root = { folders: new Map(), files: [] };

    files.forEach((file, index) => {
      const parts = file.path.split("/").filter(Boolean);
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
      const group = document.createElement("div");
      group.className = "viewer-folder-group";

      const folderRow = document.createElement("button");
      folderRow.type = "button";
      folderRow.className = "viewer-node viewer-folder-row";
      folderRow.style.setProperty("--indent", `${depth * 14}px`);
      folderRow.innerHTML = `<span class="viewer-caret">&#9662;</span><span class="viewer-label">${name}</span>`;

      const children = document.createElement("div");
      children.className = "viewer-children";
      renderTreeNode(child, children, depth + 1, onOpenFile);

      const openByDefault = depth < 1;
      folderRow.classList.toggle("closed", !openByDefault);
      children.hidden = !openByDefault;

      folderRow.addEventListener("click", () => {
        const isClosed = folderRow.classList.toggle("closed");
        children.hidden = isClosed;
      });

      group.appendChild(folderRow);
      group.appendChild(children);
      container.appendChild(group);
    });

    files.forEach((file) => {
      const fileRow = document.createElement("button");
      fileRow.type = "button";
      fileRow.className = "viewer-node viewer-file-row";
      fileRow.dataset.index = String(file.index);
      fileRow.style.setProperty("--indent", `${depth * 14 + 10}px`);
      fileRow.innerHTML = `<span class="viewer-file-dot">&#8226;</span><span class="viewer-label">${file.name}</span>`;
      fileRow.addEventListener("click", () => onOpenFile(file.index));
      container.appendChild(fileRow);
    });
  }

  function prepareFile(file) {
    if (file.ready) return file;
    file.lang = detectLang(file.path);
    file.styles = tokenize(file.code, file.lang);
    file.modifiedLines = detectModifiedLines(file.path, file.code);
    file.lineStarts = buildLineStarts(file.code);
    file.lineCount = Math.max(1, file.code.split("\n").length);
    file.ready = true;
    return file;
  }

  viewers.forEach((viewer) => {
    const templateScripts = Array.from(viewer.querySelectorAll("script[data-file]"));
    if (!templateScripts.length) return;

    const files = templateScripts.map((script) => ({
      path: script.dataset.file || "unknown.txt",
      code: (script.textContent || "").replace(/\r\n/g, "\n").trimEnd(),
      ready: false
    }));
    templateScripts.forEach((script) => script.remove());

    const tree = viewer.querySelector(".viewer-tree");
    const tabs = viewer.querySelector(".viewer-tabs");
    const lines = viewer.querySelector(".viewer-lines");
    const highlight = viewer.querySelector(".viewer-highlight");
    const input = viewer.querySelector(".viewer-input");
    const path = viewer.querySelector(".viewer-path");

    if (!tree || !tabs || !lines || !highlight || !input || !path) return;

    input.setAttribute("wrap", "off");

    const openTabs = [];
    let activeIndex = 0;
    let lockScroll = false;

    function syncTreeActive() {
      tree.querySelectorAll(".viewer-file-row").forEach((row) => {
        row.classList.toggle("active", Number(row.dataset.index) === activeIndex);
      });
    }

    function ensureTab(index) {
      if (!openTabs.includes(index)) openTabs.push(index);
    }

    function renderTabs() {
      tabs.innerHTML = "";

      openTabs.forEach((index) => {
        const file = files[index];
        if (!file) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "viewer-tab-btn";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(index === activeIndex));
        if (index === activeIndex) button.classList.add("active");

        const name = document.createElement("span");
        name.className = "viewer-tab-name";
        name.textContent = file.path.split("/").pop() || file.path;

        const close = document.createElement("span");
        close.className = "viewer-tab-close";
        close.textContent = "x";
        close.setAttribute("aria-hidden", "true");

        close.addEventListener("click", (event) => {
          event.stopPropagation();
          const tabPos = openTabs.indexOf(index);
          if (tabPos === -1) return;
          openTabs.splice(tabPos, 1);

          if (!openTabs.length) {
            openTabs.push(index);
          }

          if (activeIndex === index) {
            const fallback = openTabs[Math.max(0, tabPos - 1)] || openTabs[0];
            activeIndex = fallback;
          }
          openFile(activeIndex);
        });

        button.addEventListener("click", () => {
          activeIndex = index;
          openFile(index);
        });

        button.appendChild(name);
        button.appendChild(close);
        tabs.appendChild(button);
      });
    }

    function updateRenderFromCaret() {
      const file = prepareFile(files[activeIndex]);
      if (!file) return;

      const cursor = input.selectionStart || 0;
      const activeLine = positionToLine(file.lineStarts, cursor);
      const lineStart = file.lineStarts[activeLine - 1] || 0;
      const col = cursor - lineStart + 1;
      const bracketPair = findBracketPair(file.code, cursor);

      highlight.innerHTML = buildHighlightedLines(file, activeLine, bracketPair);
      lines.innerHTML = buildLineNumbers(file, activeLine);
      path.textContent = `${file.path}    Ln ${activeLine}, Col ${col}`;

      lines.scrollTop = input.scrollTop;
      highlight.scrollTop = input.scrollTop;
      highlight.scrollLeft = input.scrollLeft;
    }

    function openFile(index) {
      const file = prepareFile(files[index]);
      if (!file) return;

      activeIndex = index;
      ensureTab(index);
      renderTabs();
      syncTreeActive();

      input.value = file.code;
      input.setSelectionRange(0, 0);
      input.scrollTop = 0;
      input.scrollLeft = 0;
      updateRenderFromCaret();
      input.focus({ preventScroll: true });
    }

    tree.innerHTML = "";
    const root = document.createElement("div");
    root.className = "viewer-tree-root";
    renderTreeNode(buildModel(files), root, 0, (index) => {
      ensureTab(index);
      activeIndex = index;
      openFile(index);
    });
    tree.appendChild(root);

    input.addEventListener("scroll", () => {
      if (lockScroll) return;
      lockScroll = true;
      lines.scrollTop = input.scrollTop;
      highlight.scrollTop = input.scrollTop;
      highlight.scrollLeft = input.scrollLeft;
      lockScroll = false;
    });

    input.addEventListener("click", updateRenderFromCaret);
    input.addEventListener("keyup", updateRenderFromCaret);
    input.addEventListener("mouseup", updateRenderFromCaret);
    input.addEventListener("select", updateRenderFromCaret);

    openFile(0);
  });
})();

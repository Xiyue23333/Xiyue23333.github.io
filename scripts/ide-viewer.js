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
      includes: [
        "public static final String MODID = \"tutorial\";",
        "ModItems.register(modEventBus);",
        "ModBlocks.register(modEventBus);",
        "ModCreativeModeTabs.register(modEventBus);"
      ]
    },
    {
      file: /ModItems\.java$/i,
      includes: [
        "DeferredRegister.create(ForgeRegistries.ITEMS, TutorialMod.MODID)",
        "ITEMS.register(\"crystal\""
      ]
    },
    {
      file: /ModBlocks\.java$/i,
      includes: [
        "DeferredRegister.create(ForgeRegistries.BLOCKS, TutorialMod.MODID)",
        "RegistryObject<Block> CRYSTAL_BLOCK",
        "registerBlockWithItem(\"crystal_block\"",
        "items.register(name, () -> new BlockItem(block.get(), new Item.Properties()));"
      ]
    },
    {
      file: /ModCreativeModeTabs\.java$/i,
      includes: [
        "DeferredRegister.create(Registries.CREATIVE_MODE_TAB, TutorialMod.MODID)",
        "CREATIVE_MODE_TABS.register(\"tutorial_tab\"",
        ".icon(() -> new ItemStack(ModItems.CRYSTAL.get()))",
        ".title(Component.translatable(\"creativetab.tutorial_tab\"))",
        "output.accept(ModItems.CRYSTAL.get());"
      ]
    },
    {
      file: /lang[\\/]+en_us\.json$/i,
      includes: ["\"item.tutorial.crystal\"", "\"block.tutorial.crystal_block\"", "\"creativetab.tutorial_tab\""]
    },
    {
      file: /lang[\\/]+zh_cn\.json$/i,
      includes: ["\"item.tutorial.crystal\"", "\"block.tutorial.crystal_block\"", "\"creativetab.tutorial_tab\""]
    },
    {
      file: /blockstates[\\/]+crystal_block\.json$/i,
      includes: ["\"tutorial:block/crystal_block\""]
    },
    {
      file: /models[\\/]+block[\\/]+crystal_block\.json$/i,
      includes: ["\"tutorial:block/crystal_block\"", "\"block/cube_all\""]
    },
    {
      file: /models[\\/]+item[\\/]+crystal_block\.json$/i,
      includes: ["\"tutorial:block/crystal_block\""]
    },
    {
      file: /models[\\/]+item[\\/]+crystal\.json$/i,
      includes: ["\"tutorial:item/crystal\""]
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

  function computeFoldRanges(lines) {
    const foldRanges = {};
    const stack = [];
    let inBlockComment = false;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const lineNo = lineIndex + 1;
      const line = lines[lineIndex];
      let inString = null;

      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        const next = line[i + 1] || "";

        if (inBlockComment) {
          if (ch === "*" && next === "/") {
            inBlockComment = false;
            i += 1;
          }
          continue;
        }

        if (inString) {
          if (ch === "\\") {
            i += 1;
            continue;
          }
          if (ch === inString) {
            inString = null;
          }
          continue;
        }

        if (ch === "/" && next === "*") {
          inBlockComment = true;
          i += 1;
          continue;
        }

        if (ch === "/" && next === "/") {
          break;
        }

        if (ch === "\"" || ch === "'" || ch === "`") {
          inString = ch;
          continue;
        }

        if (ch === "{") {
          stack.push(lineNo);
          continue;
        }

        if (ch === "}" && stack.length) {
          const start = stack.pop();
          if (lineNo > start) {
            const prev = foldRanges[start] || 0;
            foldRanges[start] = Math.max(prev, lineNo);
          }
        }
      }
    }

    return foldRanges;
  }

  function hasModifiedInRange(modifiedLines, startLine, endLine) {
    for (let i = startLine; i <= endLine; i += 1) {
      if (modifiedLines.has(i)) return true;
    }
    return false;
  }

  function projectFile(file) {
    const rows = [];
    const total = file.linesOriginal.length;
    let line = 1;

    while (line <= total) {
      const foldEnd = file.foldRanges[line] || null;
      const isCollapsed = !!(foldEnd && file.collapsedStarts.has(line));

      rows.push({
        type: "code",
        lineNumber: line,
        text: file.linesOriginal[line - 1],
        foldStart: !!foldEnd,
        foldEnd: foldEnd,
        folded: isCollapsed,
        hasModified: file.modifiedLines.has(line)
      });

      if (isCollapsed) {
        const hiddenLines = Math.max(0, foldEnd - line);
        rows.push({
          type: "fold",
          lineNumber: null,
          text: `... 已折叠 ${hiddenLines} 行 ...`,
          startLine: line,
          endLine: foldEnd,
          hasModified: hasModifiedInRange(file.modifiedLines, line + 1, foldEnd)
        });
        line = foldEnd + 1;
      } else {
        line += 1;
      }
    }

    const visibleText = rows.map((row) => row.text).join("\n");

    return {
      rows,
      visibleText,
      visibleLineStarts: buildLineStarts(visibleText)
    };
  }

  function getSearchMatches(text, term) {
    const cleanTerm = (term || "").trim();
    if (!cleanTerm) return [];

    const lowerText = text.toLowerCase();
    const lowerTerm = cleanTerm.toLowerCase();
    const matches = [];
    let startAt = 0;

    while (startAt < lowerText.length) {
      const index = lowerText.indexOf(lowerTerm, startAt);
      if (index === -1) break;
      matches.push({ start: index, end: index + lowerTerm.length });
      startAt = index + Math.max(1, lowerTerm.length);
    }

    return matches;
  }

  function buildSearchMask(length, matches) {
    const mask = new Array(length).fill(false);
    matches.forEach((match) => {
      for (let i = match.start; i < match.end; i += 1) {
        mask[i] = true;
      }
    });
    return mask;
  }

  function findSelectedMatchIndex(matches, selectionStart, selectionEnd) {
    for (let i = 0; i < matches.length; i += 1) {
      const item = matches[i];
      if (selectionStart === selectionEnd) {
        if (selectionStart >= item.start && selectionStart <= item.end) return i;
      } else if (selectionStart === item.start && selectionEnd === item.end) {
        return i;
      }
    }
    return -1;
  }

  function buildHighlightedRows(projection, activeRow, bracketPair, tokenStyles, searchMask) {
    const bracketSet = new Set(bracketPair || []);
    const html = [];
    let globalPos = 0;

    for (let rowIndex = 0; rowIndex < projection.rows.length; rowIndex += 1) {
      const row = projection.rows[rowIndex];
      const rowClasses = ["viewer-code-line"];
      if (rowIndex + 1 === activeRow) rowClasses.push("is-active");
      if (row.hasModified) rowClasses.push("is-modified");
      if (row.type === "fold") rowClasses.push("is-fold-placeholder");

      const rowText = row.text;
      let rowHtml = "";

      if (row.type === "fold") {
        rowHtml = `<span class="tok-comment">${escapeHtml(rowText)}</span>`;
        globalPos += rowText.length;
      } else {
        let currentClass = "";
        let buffer = "";

        for (let i = 0; i < rowText.length; i += 1) {
          const char = rowText[i];
          const classes = getCharClass(char, tokenStyles[globalPos]);
          if (bracketSet.has(globalPos)) classes.push("tok-bracket-match");
          if (searchMask[globalPos]) classes.push("tok-search-hit");
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
      }

      if (rowHtml === "") rowHtml = "&nbsp;";
      html.push(`<div class="${rowClasses.join(" ")}">${rowHtml}</div>`);

      if (rowIndex < projection.rows.length - 1) {
        globalPos += 1;
      }
    }

    return html.join("");
  }

  function buildLineNumbers(projection, activeRow) {
    let html = "";
    projection.rows.forEach((row, index) => {
      const classes = ["viewer-line-num"];
      if (index + 1 === activeRow) classes.push("is-active");
      if (row.hasModified) classes.push("is-modified");
      if (row.type === "fold") classes.push("is-fold-placeholder");

      const foldCtrl = row.type === "code" && row.foldStart
        ? `<button class="viewer-fold-toggle" type="button" data-start="${row.lineNumber}" aria-label="${row.folded ? "展开代码块" : "折叠代码块"}">${row.folded ? "▸" : "▾"}</button>`
        : `<span class="viewer-fold-spacer"></span>`;
      const label = row.type === "code" ? String(row.lineNumber) : "...";

      html += `<div class="${classes.join(" ")}" data-row="${index + 1}"><span class="viewer-line-inner">${foldCtrl}<span class="viewer-line-label">${label}</span></span></div>`;
    });
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
    file.modifiedLines = detectModifiedLines(file.path, file.code);
    file.linesOriginal = file.code.split("\n");
    file.foldRanges = computeFoldRanges(file.linesOriginal);
    file.collapsedStarts = new Set();
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
    const searchInput = viewer.querySelector(".viewer-search-input");
    const searchCount = viewer.querySelector(".viewer-search-count");
    const searchButtons = Array.from(viewer.querySelectorAll(".viewer-search-btn"));

    if (!tree || !tabs || !lines || !highlight || !input || !path || !searchInput || !searchCount) return;

    input.setAttribute("wrap", "off");

    const tabMenu = document.createElement("div");
    tabMenu.className = "viewer-tab-menu";
    tabMenu.hidden = true;
    tabMenu.innerHTML = [
      '<button type="button" data-action="single">关闭</button>',
      '<button type="button" data-action="others">关闭其他</button>',
      '<button type="button" data-action="all">关闭全部</button>'
    ].join("");
    viewer.appendChild(tabMenu);

    const openTabs = [];
    let activeIndex = null;
    let currentProjection = null;
    let lockScroll = false;
    let menuTabIndex = null;

    function clearEditor() {
      currentProjection = null;
      input.value = "";
      highlight.innerHTML = "";
      lines.innerHTML = "";
      path.textContent = "未打开文件";
      searchCount.textContent = "0 / 0";
      tree.querySelectorAll(".viewer-file-row").forEach((row) => row.classList.remove("active"));
    }

    function hideTabMenu() {
      tabMenu.hidden = true;
      menuTabIndex = null;
    }

    function showTabMenu(index, clientX, clientY) {
      menuTabIndex = index;
      tabMenu.hidden = false;
      const rect = viewer.getBoundingClientRect();
      const menuWidth = 160;
      const menuHeight = 120;
      const left = Math.min(Math.max(8, clientX - rect.left), Math.max(8, rect.width - menuWidth - 8));
      const top = Math.min(Math.max(8, clientY - rect.top), Math.max(8, rect.height - menuHeight - 8));
      tabMenu.style.left = `${left}px`;
      tabMenu.style.top = `${top}px`;
    }

    function syncTreeActive() {
      tree.querySelectorAll(".viewer-file-row").forEach((row) => {
        row.classList.toggle("active", activeIndex !== null && Number(row.dataset.index) === activeIndex);
      });
    }

    function ensureTab(index) {
      if (!openTabs.includes(index)) openTabs.push(index);
    }

    function updateSearchCount(current, total) {
      if (!total) {
        searchCount.textContent = "0 / 0";
        return;
      }
      if (current <= 0) {
        searchCount.textContent = `0 / ${total}`;
        return;
      }
      searchCount.textContent = `${current} / ${total}`;
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
          closeTab(index, "single");
        });

        button.addEventListener("click", () => {
          setActiveFile(index, { ensureTab: true, resetCursor: false, keepScroll: true, focus: true });
        });

        button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          showTabMenu(index, event.clientX, event.clientY);
        });

        button.appendChild(name);
        button.appendChild(close);
        tabs.appendChild(button);
      });
    }

    function getActiveFile() {
      if (activeIndex === null) return null;
      return prepareFile(files[activeIndex]);
    }

    function rebuildVisible(options) {
      const opts = options || {};
      const file = getActiveFile();
      if (!file) {
        clearEditor();
        return;
      }

      const prevStart = input.selectionStart || 0;
      const prevEnd = input.selectionEnd || 0;
      const prevTop = input.scrollTop;
      const prevLeft = input.scrollLeft;

      currentProjection = projectFile(file);
      input.value = currentProjection.visibleText;

      const nextStart = opts.resetCursor ? 0 : Math.min(prevStart, input.value.length);
      const nextEnd = opts.resetCursor ? 0 : Math.min(prevEnd, input.value.length);
      input.setSelectionRange(nextStart, nextEnd);

      if (opts.keepScroll) {
        input.scrollTop = prevTop;
        input.scrollLeft = prevLeft;
      } else {
        input.scrollTop = 0;
        input.scrollLeft = 0;
      }
    }

    function updateRenderFromCaret() {
      const file = getActiveFile();
      if (!file || !currentProjection) return;

      const cursorStart = input.selectionStart || 0;
      const cursorEnd = input.selectionEnd || cursorStart;
      const visibleText = currentProjection.visibleText;
      const activeRow = Math.min(
        Math.max(1, positionToLine(currentProjection.visibleLineStarts, cursorStart)),
        Math.max(1, currentProjection.rows.length)
      );
      const activeRowData = currentProjection.rows[activeRow - 1] || null;
      const lineStart = currentProjection.visibleLineStarts[activeRow - 1] || 0;
      const col = cursorStart - lineStart + 1;

      const tokenStyles = tokenize(visibleText, file.lang);
      const bracketPair = findBracketPair(visibleText, cursorStart);

      const searchTerm = searchInput.value.trim();
      const searchMatches = getSearchMatches(visibleText, searchTerm);
      const searchMask = buildSearchMask(visibleText.length, searchMatches);
      const selectedMatchIndex = findSelectedMatchIndex(searchMatches, cursorStart, cursorEnd);

      highlight.innerHTML = buildHighlightedRows(currentProjection, activeRow, bracketPair, tokenStyles, searchMask);
      lines.innerHTML = buildLineNumbers(currentProjection, activeRow);

      const lineDisplay = activeRowData && activeRowData.type === "code"
        ? String(activeRowData.lineNumber)
        : (activeRowData ? `${activeRowData.startLine}-${activeRowData.endLine}` : "0");
      path.textContent = `${file.path}    Ln ${lineDisplay}, Col ${col}`;

      lines.scrollTop = input.scrollTop;
      highlight.scrollTop = input.scrollTop;
      highlight.scrollLeft = input.scrollLeft;

      updateSearchCount(selectedMatchIndex + 1, searchMatches.length);
    }

    function setActiveFile(index, options) {
      if (index === null || index === undefined || !files[index]) return;
      const opts = options || {};

      activeIndex = index;
      if (opts.ensureTab !== false) ensureTab(index);
      renderTabs();
      syncTreeActive();
      hideTabMenu();

      rebuildVisible({
        resetCursor: !!opts.resetCursor,
        keepScroll: !!opts.keepScroll
      });
      updateRenderFromCaret();

      if (opts.focus !== false) {
        input.focus({ preventScroll: true });
      }
    }

    function closeTab(index, mode) {
      const tabPos = openTabs.indexOf(index);
      if (tabPos === -1) return;

      if (mode === "others") {
        openTabs.length = 0;
        openTabs.push(index);
        setActiveFile(index, { ensureTab: false, resetCursor: false, keepScroll: true, focus: false });
        return;
      }

      if (mode === "all") {
        openTabs.length = 0;
        activeIndex = null;
        renderTabs();
        hideTabMenu();
        clearEditor();
        return;
      }

      openTabs.splice(tabPos, 1);

      if (!openTabs.length) {
        activeIndex = null;
        renderTabs();
        hideTabMenu();
        clearEditor();
        return;
      }

      if (activeIndex === index) {
        const fallback = openTabs[Math.max(0, tabPos - 1)] || openTabs[0];
        setActiveFile(fallback, { ensureTab: false, resetCursor: false, keepScroll: true, focus: false });
      } else {
        renderTabs();
      }
    }

    function jumpSearch(direction) {
      if (activeIndex === null || !currentProjection) return;
      const term = searchInput.value.trim();
      if (!term) return;

      const matches = getSearchMatches(input.value, term);
      if (!matches.length) {
        updateRenderFromCaret();
        return;
      }

      const start = input.selectionStart || 0;
      const end = input.selectionEnd || start;
      const selectedIndex = findSelectedMatchIndex(matches, start, end);
      let targetIndex = -1;

      if (direction > 0) {
        if (selectedIndex >= 0) {
          targetIndex = (selectedIndex + 1) % matches.length;
        } else {
          targetIndex = matches.findIndex((match) => match.start > start);
          if (targetIndex === -1) targetIndex = 0;
        }
      } else {
        if (selectedIndex >= 0) {
          targetIndex = (selectedIndex - 1 + matches.length) % matches.length;
        } else {
          for (let i = matches.length - 1; i >= 0; i -= 1) {
            if (matches[i].end < start) {
              targetIndex = i;
              break;
            }
          }
          if (targetIndex === -1) targetIndex = matches.length - 1;
        }
      }

      const target = matches[targetIndex];
      input.setSelectionRange(target.start, target.end);
      updateRenderFromCaret();
      input.focus({ preventScroll: true });
    }

    tree.innerHTML = "";
    const root = document.createElement("div");
    root.className = "viewer-tree-root";
    renderTreeNode(buildModel(files), root, 0, (index) => {
      ensureTab(index);
      setActiveFile(index, { ensureTab: true, resetCursor: true, keepScroll: false, focus: true });
    });
    tree.appendChild(root);

    tabMenu.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-action");
      if (!action || menuTabIndex === null) return;
      closeTab(menuTabIndex, action);
      hideTabMenu();
    });

    document.addEventListener("mousedown", (event) => {
      if (!tabMenu.hidden && !tabMenu.contains(event.target)) {
        hideTabMenu();
      }
    });

    window.addEventListener("blur", hideTabMenu);
    window.addEventListener("resize", hideTabMenu);

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

    input.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        jumpSearch(event.shiftKey ? -1 : 1);
      }
    });

    lines.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const foldButton = target.closest(".viewer-fold-toggle");
      if (foldButton) {
        const startLine = Number(foldButton.getAttribute("data-start"));
        const file = getActiveFile();
        if (!file || !startLine) return;

        if (file.collapsedStarts.has(startLine)) {
          file.collapsedStarts.delete(startLine);
        } else {
          file.collapsedStarts.add(startLine);
        }

        rebuildVisible({ resetCursor: false, keepScroll: true });
        updateRenderFromCaret();
        return;
      }

      const row = target.closest(".viewer-line-num");
      if (!row || !currentProjection) return;
      const rowIndex = Number(row.getAttribute("data-row"));
      if (!rowIndex || currentProjection.visibleLineStarts[rowIndex - 1] === undefined) return;

      const targetPos = currentProjection.visibleLineStarts[rowIndex - 1];
      input.setSelectionRange(targetPos, targetPos);
      updateRenderFromCaret();
      input.focus({ preventScroll: true });
    });

    searchInput.addEventListener("input", () => {
      updateRenderFromCaret();
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpSearch(event.shiftKey ? -1 : 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        searchInput.value = "";
        updateRenderFromCaret();
        input.focus({ preventScroll: true });
      }
    });

    searchButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const direction = Number(btn.getAttribute("data-search-nav")) || 1;
        jumpSearch(direction);
      });
    });

    ensureTab(0);
    setActiveFile(0, { ensureTab: true, resetCursor: true, keepScroll: false, focus: false });
  });
})();

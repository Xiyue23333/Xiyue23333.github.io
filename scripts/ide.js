(function () {
  const PRESET_FILES = {
    'getting-started.html': [
      {
        name: 'src/main/java/com/craftmodlab/registry/ModItems.java',
        code: `package com.craftmodlab.registry;

public final class ModItems {
  private ModItems() {}

  public static void register() {
    // TODO: register your items
  }
}`,
      },
      {
        name: 'build.gradle',
        code: `plugins {
  id 'java'
  id 'net.neoforged.gradle.userdev' version '7.0.181'
}

group = 'com.craftmodlab'
version = '0.1.0'`,
      },
    ],
    'environment.html': [
      {
        name: 'gradle.properties',
        code: `org.gradle.jvmargs=-Xmx3G
org.gradle.daemon=false
minecraft_version=1.20.1
mod_id=craftmodlab`,
      },
      {
        name: 'scripts/run.ps1',
        code: `./gradlew clean
./gradlew --refresh-dependencies
./gradlew runClient`,
      },
    ],
    'first-item.html': [
      {
        name: 'src/main/resources/assets/craftmodlab/lang/zh_cn.json',
        code: `{
  "item.craftmodlab.copper_dust": "铜粉"
}`,
      },
      {
        name: 'src/main/resources/assets/craftmodlab/models/item/copper_dust.json',
        code: `{
  "parent": "minecraft:item/generated",
  "textures": {
    "layer0": "craftmodlab:item/copper_dust"
  }
}`,
      },
    ],
    'first-block.html': [
      {
        name: 'src/main/resources/assets/craftmodlab/blockstates/steel_block.json',
        code: `{
  "variants": {
    "": { "model": "craftmodlab:block/steel_block" }
  }
}`,
      },
      {
        name: 'src/main/resources/data/craftmodlab/recipes/steel_block.json',
        code: `{
  "type": "minecraft:crafting_shaped",
  "pattern": ["###", "###", "###"],
  "key": {"#": {"item": "minecraft:iron_ingot"}},
  "result": {"item": "craftmodlab:steel_block"}
}`,
      },
    ],
    'registry-data-gen.html': [
      {
        name: 'src/main/java/com/craftmodlab/datagen/ModRecipeProvider.java',
        code: `ShapedRecipeBuilder.shaped(RecipeCategory.BUILDING_BLOCKS, ModBlocks.STEEL_BLOCK.get())
  .pattern("###")
  .pattern("###")
  .pattern("###")
  .define('#', Items.IRON_INGOT)
  .unlockedBy("has_iron", has(Items.IRON_INGOT))
  .save(output);`,
      },
      {
        name: 'src/main/java/com/craftmodlab/datagen/ModLanguageProvider.java',
        code: `@Override
protected void addTranslations() {
  add(ModItems.COPPER_DUST.get(), "Copper Dust");
  add(ModBlocks.STEEL_BLOCK.get(), "Steel Block");
}`,
      },
    ],
    'networking.html': [
      {
        name: 'src/main/java/com/craftmodlab/network/ToggleModePacket.java',
        code: `public static void handle(ToggleModePacket msg, Supplier<NetworkEvent.Context> ctx) {
  ctx.get().enqueueWork(() -> {
    ServerPlayer player = ctx.get().getSender();
    if (player != null) {
      ModeState.toggle(player);
    }
  });
  ctx.get().setPacketHandled(true);
}`,
      },
      {
        name: 'src/main/java/com/craftmodlab/client/ClientInputEvents.java',
        code: `@SubscribeEvent
public static void onKeyInput(InputEvent.Key event) {
  if (KEY_TOGGLE.consumeClick()) {
    CHANNEL.sendToServer(new ToggleModePacket());
  }
}`,
      },
    ],
    'release.html': [
      {
        name: 'docs/CHANGELOG.md',
        code: `## 1.0.0
- 首个公开版本
- 新增 steel_block 与 copper_dust
- 完成联机同步基础功能`,
      },
      {
        name: 'docs/publish-checklist.md',
        code: `- [ ] ./gradlew clean build
- [ ] 检查 build/libs 产物
- [ ] 更新版本号与日志
- [ ] 上传到 GitHub Releases / Modrinth / CurseForge`,
      },
    ],
  };

  const PRIMARY_FILE = {
    'getting-started.html': 'src/main/java/com/craftmodlab/CraftModLab.java',
    'environment.html': 'build.gradle',
    'first-item.html': 'src/main/java/com/craftmodlab/registry/ModItems.java',
    'first-block.html': 'src/main/java/com/craftmodlab/registry/ModBlocks.java',
    'registry-data-gen.html': 'src/main/java/com/craftmodlab/datagen/ModItemModelProvider.java',
    'networking.html': 'src/main/java/com/craftmodlab/network/ModNetwork.java',
    'release.html': 'gradle.properties',
  };

  const KEYWORDS = {
    java: [
      'package', 'import', 'public', 'private', 'protected', 'class', 'interface', 'enum',
      'extends', 'implements', 'static', 'final', 'void', 'new', 'return', 'if', 'else',
      'switch', 'case', 'default', 'for', 'while', 'do', 'break', 'continue', 'try', 'catch',
      'finally', 'throw', 'throws', 'this', 'super', 'true', 'false', 'null'
    ],
    json: ['true', 'false', 'null'],
    gradle: [
      'plugins', 'id', 'version', 'group', 'repositories', 'dependencies',
      'implementation', 'api', 'runtimeOnly', 'compileOnly', 'testImplementation',
      'task', 'tasks', 'register', 'java'
    ],
    shell: ['if', 'else', 'for', 'while', 'do', 'done', 'function', 'return'],
    markdown: ['TODO']
  };

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function detectLang(fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.java')) return 'java';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.gradle') || lower.endsWith('.properties')) return 'gradle';
    if (lower.endsWith('.md')) return 'markdown';
    if (lower.endsWith('.ps1') || lower.endsWith('.sh')) return 'shell';
    return 'plain';
  }

  function highlightCode(raw, fileName) {
    const lang = detectLang(fileName);
    const tokenStore = [];
    let working = raw.replace(/\r\n/g, '\n');

    function stashRaw(regex, className) {
      working = working.replace(regex, (match) => {
        const id = tokenStore.push(`<span class="${className}">${escapeHtml(match)}</span>`) - 1;
        return `__TOK_${id}__`;
      });
    }

    function stashEscaped(pattern, className) {
      working = working.replace(pattern, (match) => {
        const id = tokenStore.push(`<span class="${className}">${match}</span>`) - 1;
        return `__TOK_${id}__`;
      });
    }

    stashRaw(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, 'tok-string');
    stashRaw(/\/\*[\s\S]*?\*\//g, 'tok-comment');
    stashRaw(/\/\/[^\n]*/g, 'tok-comment');

    working = escapeHtml(working);

    const keywords = KEYWORDS[lang] || [];
    if (keywords.length > 0) {
      const pattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
      stashEscaped(pattern, 'tok-keyword');
    }

    stashEscaped(/\b(\d+(?:\.\d+)?(?:[fFdDlL])?)\b/g, 'tok-number');
    stashEscaped(/(@[A-Za-z_][A-Za-z0-9_]*)/g, 'tok-anno');
    stashEscaped(/([=+\-*/%<>!&|?:]+)/g, 'tok-operator');

    working = working.replace(/[{}()[\]]/g, (char) => {
      const classMap = {
        '{': 'tok-brace',
        '}': 'tok-brace',
        '(': 'tok-paren',
        ')': 'tok-paren',
        '[': 'tok-square',
        ']': 'tok-square'
      };
      const id = tokenStore.push(`<span class="tok-bracket ${classMap[char]}">${char}</span>`) - 1;
      return `__TOK_${id}__`;
    });

    working = working.replace(/__TOK_(\d+)__/g, (_, index) => tokenStore[Number(index)] || '');
    return working;
  }

  function fileTreeFromPaths(files) {
    const root = { folders: new Map(), files: [] };

    files.forEach((file, index) => {
      const chunks = file.name.split('/').filter(Boolean);
      if (chunks.length === 0) return;

      let node = root;
      for (let i = 0; i < chunks.length - 1; i += 1) {
        const folder = chunks[i];
        if (!node.folders.has(folder)) {
          node.folders.set(folder, { folders: new Map(), files: [] });
        }
        node = node.folders.get(folder);
      }

      node.files.push({ name: chunks[chunks.length - 1], index });
    });

    return root;
  }

  function createWorkbench(inputFiles) {
    const files = [];
    const used = new Set();
    inputFiles.forEach((file) => {
      if (used.has(file.name)) return;
      used.add(file.name);
      files.push({ name: file.name, code: file.code.replace(/\r\n/g, '\n') });
    });

    const root = document.createElement('div');
    root.className = 'ide-workbench';
    root.innerHTML = `
      <aside class="ide-sidebar">
        <p class="ide-heading">项目</p>
        <div class="ide-tree"></div>
      </aside>
      <section class="ide-editor">
        <div class="ide-topbar">
          <span class="ide-dot red"></span>
          <span class="ide-dot amber"></span>
          <span class="ide-dot green"></span>
          <div class="ide-tabbar"></div>
        </div>
        <div class="ide-editor-pane">
          <div class="ide-lines" aria-hidden="true"></div>
          <div class="ide-code-wrap">
            <pre class="ide-highlight" aria-hidden="true"></pre>
            <textarea class="ide-code" spellcheck="false"></textarea>
          </div>
        </div>
        <div class="ide-statusbar">
          <span class="ide-status-file"></span>
          <span class="ide-status-pos">Ln 1, Col 1</span>
        </div>
      </section>
    `;

    const tree = root.querySelector('.ide-tree');
    const tabbar = root.querySelector('.ide-tabbar');
    const lines = root.querySelector('.ide-lines');
    const highlight = root.querySelector('.ide-highlight');
    const code = root.querySelector('.ide-code');
    const statusFile = root.querySelector('.ide-status-file');
    const statusPos = root.querySelector('.ide-status-pos');

    const state = {
      active: 0,
      openTabs: [0],
      initialized: false
    };

    function renderTree() {
      tree.innerHTML = '';
      const model = fileTreeFromPaths(files);
      const rootContainer = document.createElement('div');
      rootContainer.className = 'ide-tree-root';

      function renderFolderNode(node, container, depth) {
        const folderEntries = Array.from(node.folders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        folderEntries.forEach(([folderName, folderNode]) => {
          const details = document.createElement('details');
          details.className = 'ide-folder';
          if (depth < 2) details.open = true;

          const summary = document.createElement('summary');
          summary.style.setProperty('--indent', `${depth * 14}px`);
          summary.innerHTML = `<span class="ide-folder-name">${folderName}</span>`;
          details.appendChild(summary);

          const children = document.createElement('div');
          children.className = 'ide-folder-children';
          renderFolderNode(folderNode, children, depth + 1);
          details.appendChild(children);

          container.appendChild(details);
        });

        node.files
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((fileEntry) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ide-file';
            btn.dataset.index = String(fileEntry.index);
            btn.style.setProperty('--indent', `${depth * 14 + 10}px`);
            btn.textContent = fileEntry.name;
            btn.addEventListener('click', () => openFile(fileEntry.index));
            container.appendChild(btn);
          });
      }

      renderFolderNode(model, rootContainer, 0);
      tree.appendChild(rootContainer);
    }

    function renderLineNumbers(text) {
      const lineCount = Math.max(1, text.split('\n').length);
      let html = '';
      for (let i = 1; i <= lineCount; i += 1) {
        html += `<span>${i}</span>`;
      }
      lines.innerHTML = html;
      lines.scrollTop = code.scrollTop;
    }

    function syncStatus() {
      const cursor = code.selectionStart;
      const before = code.value.slice(0, cursor);
      const row = before.split('\n').length;
      const col = before.length - before.lastIndexOf('\n');
      statusPos.textContent = `Ln ${row}, Col ${col}`;
    }

    function renderHighlight() {
      const activeFile = files[state.active];
      highlight.innerHTML = `${highlightCode(code.value, activeFile.name)}\n`;
      highlight.scrollTop = code.scrollTop;
      highlight.scrollLeft = code.scrollLeft;
      renderLineNumbers(code.value);
      syncStatus();
    }

    function renderTabs() {
      tabbar.innerHTML = '';

      state.openTabs.forEach((fileIndex) => {
        const active = fileIndex === state.active;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = `ide-tab-btn${active ? ' active' : ''}`;
        tab.dataset.index = String(fileIndex);
        tab.innerHTML = `
          <span class="ide-tab-name">${files[fileIndex].name.split('/').pop()}</span>
          <span class="ide-tab-close" data-close="${fileIndex}">x</span>
        `;
        tab.addEventListener('click', (event) => {
          const closeTarget = event.target instanceof Element ? event.target.closest('[data-close]') : null;
          if (closeTarget) {
            event.stopPropagation();
            closeTab(Number(closeTarget.getAttribute('data-close')));
            return;
          }
          openFile(fileIndex);
        });
        tabbar.appendChild(tab);
      });
    }

    function saveCurrentFile() {
      if (!state.initialized) return;
      files[state.active].code = code.value;
    }

    function setActiveTreeItem() {
      tree.querySelectorAll('.ide-file').forEach((node) => {
        node.classList.toggle('active', Number(node.dataset.index) === state.active);
      });
    }

    function openFile(index) {
      if (!files[index]) return;
      if (state.initialized) {
        saveCurrentFile();
      }
      state.active = index;
      if (!state.openTabs.includes(index)) {
        state.openTabs.push(index);
      }

      const file = files[index];
      code.value = file.code;
      state.initialized = true;
      statusFile.textContent = file.name;
      renderTabs();
      setActiveTreeItem();
      renderHighlight();
      code.focus();
    }

    function closeTab(index) {
      if (state.openTabs.length === 1) return;
      const pos = state.openTabs.indexOf(index);
      if (pos === -1) return;

      state.openTabs.splice(pos, 1);

      if (state.active === index) {
        const fallback = state.openTabs[Math.max(0, pos - 1)] || state.openTabs[0];
        openFile(fallback);
      } else {
        renderTabs();
      }
    }

    code.addEventListener('input', () => {
      files[state.active].code = code.value;
      renderHighlight();
    });

    code.addEventListener('scroll', () => {
      lines.scrollTop = code.scrollTop;
      highlight.scrollTop = code.scrollTop;
      highlight.scrollLeft = code.scrollLeft;
    });

    code.addEventListener('keyup', syncStatus);
    code.addEventListener('click', syncStatus);

    renderTree();
    openFile(0);

    return root;
  }

  function enhanceCodeBlocks() {
    const page = window.location.pathname.split('/').pop();
    const preset = PRESET_FILES[page] || [];
    const primaryName = PRIMARY_FILE[page] || 'src/main/java/com/example/Example.java';

    document.querySelectorAll('.section pre').forEach((pre) => {
      if (pre.closest('.ide-workbench')) return;
      const text = (pre.querySelector('code') || pre).textContent.trim();
      if (!text) return;

      const files = [{ name: primaryName, code: text }, ...preset];
      const ide = createWorkbench(files);
      pre.replaceWith(ide);
    });
  }

  enhanceCodeBlocks();
})();

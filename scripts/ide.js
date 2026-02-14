(function () {
  const PRESET_FILES = {
    'getting-started.html': [
      {
        name: 'ModItems.java',
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
        name: 'run.ps1',
        code: `./gradlew clean
./gradlew --refresh-dependencies
./gradlew runClient`,
      },
    ],
    'first-item.html': [
      {
        name: 'zh_cn.json',
        code: `{
  "item.craftmodlab.copper_dust": "铜粉"
}`,
      },
      {
        name: 'models/item/copper_dust.json',
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
        name: 'blockstates/steel_block.json',
        code: `{
  "variants": {
    "": { "model": "craftmodlab:block/steel_block" }
  }
}`,
      },
      {
        name: 'recipes/steel_block.json',
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
        name: 'ModRecipeProvider.java',
        code: `ShapedRecipeBuilder.shaped(RecipeCategory.BUILDING_BLOCKS, ModBlocks.STEEL_BLOCK.get())
  .pattern("###")
  .pattern("###")
  .pattern("###")
  .define('#', Items.IRON_INGOT)
  .unlockedBy("has_iron", has(Items.IRON_INGOT))
  .save(output);`,
      },
      {
        name: 'ModLanguageProvider.java',
        code: `@Override
protected void addTranslations() {
  add(ModItems.COPPER_DUST.get(), "Copper Dust");
  add(ModBlocks.STEEL_BLOCK.get(), "Steel Block");
}`,
      },
    ],
    'networking.html': [
      {
        name: 'ToggleModePacket.java',
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
        name: 'ClientInputEvents.java',
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
        name: 'CHANGELOG.md',
        code: `## 1.0.0
- 首个公开版本
- 新增 steel_block 与 copper_dust
- 完成联机同步基础功能`,
      },
      {
        name: 'publish-checklist.md',
        code: `- [ ] ./gradlew clean build
- [ ] 检查 build/libs 产物
- [ ] 更新版本号与日志
- [ ] 上传到 GitHub Releases / Modrinth / CurseForge`,
      },
    ],
  };

  const PRIMARY_FILE = {
    'getting-started.html': 'CraftModLab.java',
    'environment.html': 'build.gradle',
    'first-item.html': 'ModItems.java',
    'first-block.html': 'ModBlocks.java',
    'registry-data-gen.html': 'ModItemModelProvider.java',
    'networking.html': 'ModNetwork.java',
    'release.html': 'gradle.properties',
  };

  function createWorkbench(files) {
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
          <div class="ide-tabbar"><span class="ide-tab active"></span></div>
        </div>
        <div class="ide-editor-pane">
          <div class="ide-lines" aria-hidden="true"></div>
          <textarea class="ide-code" spellcheck="false"></textarea>
        </div>
      </section>
    `;

    const tree = root.querySelector('.ide-tree');
    const tab = root.querySelector('.ide-tab');
    const lines = root.querySelector('.ide-lines');
    const code = root.querySelector('.ide-code');

    const state = { active: 0 };

    function refreshLines() {
      const lineCount = Math.max(1, code.value.split('\n').length);
      let html = '';
      for (let i = 1; i <= lineCount; i += 1) {
        html += `<span>${i}</span>`;
      }
      lines.innerHTML = html;
      lines.scrollTop = code.scrollTop;
    }

    function openFile(index) {
      const file = files[index];
      if (!file) return;
      state.active = index;
      tab.textContent = file.name;
      code.value = file.code;
      tree.querySelectorAll('.ide-file').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
      });
      refreshLines();
    }

    files.forEach((file, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ide-file${i === 0 ? ' active' : ''}`;
      btn.textContent = file.name;
      btn.addEventListener('click', () => openFile(i));
      tree.appendChild(btn);
    });

    code.addEventListener('input', refreshLines);
    code.addEventListener('scroll', () => {
      lines.scrollTop = code.scrollTop;
    });

    openFile(0);
    return root;
  }

  function enhanceCodeBlocks() {
    const page = window.location.pathname.split('/').pop();
    const preset = PRESET_FILES[page] || [];
    const primaryName = PRIMARY_FILE[page] || 'Example.java';

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

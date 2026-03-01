(function () {
  const root = document.querySelector("[data-shader-lab]");
  if (!root) return;

  const codeEl = root.querySelector("[data-code]");
  const linesEl = root.querySelector("[data-lines]");
  const codeWrapEl = root.querySelector(".shader-code-wrap");
  const highlightEl = root.querySelector("[data-highlight]");
  const logEl = root.querySelector("[data-log]");
  const logWrapEl = root.querySelector("[data-log-wrap]");
  const templateEl = root.querySelector("[data-template]");
  const imageEl = root.querySelector("[data-image]");
  const shaderFilesEl = root.querySelector("[data-shader-files]");
  const bgEl = root.querySelector("[data-bg]");
  const canvasWrapEl = root.querySelector("[data-canvas-wrap]");
  const canvasEl = root.querySelector("[data-canvas]");
  const statusEl = root.querySelector("[data-canvas-status]");
  const reloadBtn = root.querySelector("[data-action='reload']");
  const resetBtn = root.querySelector("[data-action='reset']");
  const applyTemplateBtn = root.querySelector("[data-action='apply-template']");
  const fileHintEl = root.querySelector("[data-filehint]");
  const fileTabs = Array.from(root.querySelectorAll("[data-file-tab]"));

  if (!codeEl || !linesEl || !logEl || !canvasEl || !canvasWrapEl || !reloadBtn || !resetBtn) return;

  const STAGE_LINES = 25;

  const TEMPLATE_VSH = `#version 150

in vec3 Position;
in vec4 Color;
in vec2 UV0;

uniform mat4 ModelViewMat;
uniform mat4 ProjMat;

out vec2 texCoord0;
out vec4 vertexColor;

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);
    texCoord0 = UV0;
    vertexColor = Color;
}
`;

  const TEMPLATE_FSH = `#version 150

uniform sampler2D Sampler0; // 对应你的底图
uniform float GameTime;      // Minecraft 内置时间变量
uniform vec4 ColorModulator;

in vec2 texCoord0;
in vec4 vertexColor;
out vec4 fragColor;

float Hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 p = texCoord0 * 2.0 - 1.0;
    float dist = length(p);
    float angle = atan(p.y, p.x);
    if (dist > 1.0) discard;

    float coreSize = 0.28;
    vec3 purple = vec3(0.7, 0.2, 1.0);

    float time = GameTime * 1200.0;
    vec2 polarUV;
    polarUV.x = angle / 6.2831 + time * 0.1;
    polarUV.y = 1.0 / (dist + 0.02) - time * 0.3;

    vec4 texCol = texture(Sampler0, polarUV);

    vec3 col = purple * texCol.r * (0.4 / (dist + 0.01));

    float glow = exp(-30.0 * abs(dist - coreSize));
    col += mix(purple, vec3(1.0), 0.5) * glow * 1.5;

    if (dist < coreSize) {
        col = vec3(0.0);
    }

    float alpha = smoothstep(1.0, 0.4, dist);
    fragColor = vec4(col, alpha) * vertexColor * ColorModulator;
}
`;

  const TEMPLATE_FSH_RIPPLE = `#version 150

uniform sampler2D Sampler0;
uniform float GameTime;
uniform vec4 ColorModulator;
uniform vec2 ScreenSize;

in vec2 texCoord0;
in vec4 vertexColor;
out vec4 fragColor;

void main() {
    vec2 uv = texCoord0;
    float t = GameTime;

    vec2 p = uv * 2.0 - 1.0;
    float dist = length(p);

    float wave = 0.02 * sin(dist * 18.0 - t * 3.0);
    vec2 dir = dist > 0.0001 ? (p / dist) : vec2(0.0);
    vec2 uv2 = uv + dir * wave;

    vec4 texCol = texture(Sampler0, uv2);
    vec3 col = texCol.rgb;
    col *= mix(1.05, 0.8, smoothstep(0.2, 1.0, dist));

    fragColor = vec4(col, texCol.a) * vertexColor * ColorModulator;
}
`;

  const TEMPLATE_FSH_PIXELATE = `#version 150

uniform sampler2D Sampler0;
uniform float GameTime;
uniform vec4 ColorModulator;
uniform vec2 ScreenSize;

in vec2 texCoord0;
in vec4 vertexColor;
out vec4 fragColor;

void main() {
    vec2 uv = texCoord0;
    vec2 res = max(ScreenSize, vec2(2.0));

    float pixelSize = 10.0 + 6.0 * sin(GameTime * 0.8);
    vec2 grid = res / pixelSize;
    vec2 uv2 = (floor(uv * grid) + 0.5) / grid;

    vec4 texCol = texture(Sampler0, uv2);
    fragColor = texCol * vertexColor * ColorModulator;
}
`;

  const TEMPLATE_FSH_RGB_SHIFT = `#version 150

uniform sampler2D Sampler0;
uniform float GameTime;
uniform vec4 ColorModulator;
uniform vec2 ScreenSize;

in vec2 texCoord0;
in vec4 vertexColor;
out vec4 fragColor;

void main() {
    vec2 uv = texCoord0;
    float t = GameTime;

    float amp = 0.006 + 0.003 * sin(t * 1.7);
    vec2 off = vec2(amp, 0.0);

    float r = texture(Sampler0, uv + off).r;
    float g = texture(Sampler0, uv).g;
    float b = texture(Sampler0, uv - off).b;
    float a = texture(Sampler0, uv).a;

    vec3 col = vec3(r, g, b);
    fragColor = vec4(col, a) * vertexColor * ColorModulator;
}
`;

  const TEMPLATE_FSH_SCANLINES = `#version 150

uniform sampler2D Sampler0;
uniform float GameTime;
uniform vec4 ColorModulator;
uniform vec2 ScreenSize;

in vec2 texCoord0;
in vec4 vertexColor;
out vec4 fragColor;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = texCoord0;
    vec4 texCol = texture(Sampler0, uv);

    float y = uv.y * max(ScreenSize.y, 2.0);
    float scan = 0.9 + 0.1 * sin(y * 3.14159);

    float noise = hash(uv * 1200.0 + GameTime) * 0.03;
    vec3 col = texCol.rgb * scan + noise;

    fragColor = vec4(col, texCol.a) * vertexColor * ColorModulator;
}
`;

  const TEMPLATE_FSH_DISSOLVE = `#version 150

uniform sampler2D Sampler0;
uniform float GameTime;
uniform vec4 ColorModulator;
uniform vec2 ScreenSize;

in vec2 texCoord0;
in vec4 vertexColor;
out vec4 fragColor;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 uv = texCoord0;
    vec4 texCol = texture(Sampler0, uv);

    float n = hash(floor(uv * vec2(220.0, 220.0)));
    float threshold = 0.35 + 0.25 * sin(GameTime * 0.9);

    float edge = smoothstep(threshold - 0.03, threshold + 0.03, n);
    if (edge < 0.02) discard;

    vec3 edgeCol = mix(vec3(1.0, 0.6, 0.2), vec3(1.0), edge);
    vec3 col = mix(edgeCol, texCol.rgb, edge);

    fragColor = vec4(col, texCol.a * edge) * vertexColor * ColorModulator;
}
`;

  const TEMPLATE_FSH_PLASMA = `#version 150

uniform float GameTime;
uniform vec4 ColorModulator;
uniform vec2 ScreenSize;

in vec2 texCoord0;
in vec4 vertexColor;
out vec4 fragColor;

void main() {
    vec2 uv = texCoord0;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= max(ScreenSize.x / max(ScreenSize.y, 2.0), 1.0);

    float t = GameTime;
    float v = 0.0;
    v += sin(p.x * 6.0 + t * 1.2);
    v += sin(p.y * 7.0 - t * 1.1);
    v += sin((p.x + p.y) * 5.0 + t * 0.9);
    v = v / 3.0;

    vec3 col = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + v + t * 0.05));
    fragColor = vec4(col, 1.0) * vertexColor * ColorModulator;
}
`;

  function buildJson(id) {
    const safe = String(id || "template");
    return `{
  "blend": {
    "func": "add",
    "srcfactor": "src_alpha",
    "dstfactor": "one_minus_src_alpha"
  },
  "vertex": "trimupgrade:${safe}",
  "fragment": "trimupgrade:${safe}",
  "attributes": [
    "Position",
    "Color",
    "UV0"
  ],
  "uniforms": [
    { "name": "ModelViewMat", "type": "matrix4x4", "count": 16, "values": [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ] },
    { "name": "ProjMat",      "type": "matrix4x4", "count": 16, "values": [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ] },
    { "name": "GameTime",     "type": "float",     "count": 1,  "values": [ 0.0 ] },
    { "name": "ColorModulator","type": "float",    "count": 4,  "values": [ 1.0, 1.0, 1.0, 1.0 ] }
  ],
  "samplers": [
    { "name": "Sampler0" }
  ]
}
`;
  }

  const TEMPLATE_JSON = `{
  "blend": {
    "func": "add",
    "srcfactor": "src_alpha",
    "dstfactor": "one_minus_src_alpha"
  },
  "vertex": "trimupgrade:black_hole",
  "fragment": "trimupgrade:black_hole",
  "attributes": [
    "Position",
    "Color",
    "UV0"
  ],
  "uniforms": [
    { "name": "ModelViewMat", "type": "matrix4x4", "count": 16, "values": [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ] },
    { "name": "ProjMat",      "type": "matrix4x4", "count": 16, "values": [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ] },
    { "name": "GameTime",     "type": "float",     "count": 1,  "values": [ 0.0 ] },
    { "name": "ColorModulator","type": "float",     "count": 4,  "values": [ 1.0, 1.0, 1.0, 1.0 ] }
  ],
  "samplers": [
    { "name": "Sampler0" }
  ]
}
`;

  const TEMPLATES = {
    black_hole: { id: "black_hole", label: "黑洞（极坐标旋涡）", vsh: TEMPLATE_VSH, fsh: TEMPLATE_FSH, json: TEMPLATE_JSON },
    ripple: { id: "ripple", label: "水波纹（贴图扭曲）", vsh: TEMPLATE_VSH, fsh: TEMPLATE_FSH_RIPPLE, json: buildJson("ripple") },
    pixelate: { id: "pixelate", label: "像素化（马赛克）", vsh: TEMPLATE_VSH, fsh: TEMPLATE_FSH_PIXELATE, json: buildJson("pixelate") },
    rgb_shift: { id: "rgb_shift", label: "RGB 偏移（色散）", vsh: TEMPLATE_VSH, fsh: TEMPLATE_FSH_RGB_SHIFT, json: buildJson("rgb_shift") },
    scanlines: { id: "scanlines", label: "扫描线（屏幕质感）", vsh: TEMPLATE_VSH, fsh: TEMPLATE_FSH_SCANLINES, json: buildJson("scanlines") },
    dissolve: { id: "dissolve", label: "溶解（噪声裁剪）", vsh: TEMPLATE_VSH, fsh: TEMPLATE_FSH_DISSOLVE, json: buildJson("dissolve") },
    plasma: { id: "plasma", label: "等离子（程序纹理）", vsh: TEMPLATE_VSH, fsh: TEMPLATE_FSH_PLASMA, json: buildJson("plasma") },
  };

  function templateFileNames(id) {
    const safe = String(id || "template");
    return { fsh: `${safe}.fsh`, vsh: `${safe}.vsh`, json: `${safe}.json` };
  }

  const FILE_META = {
    fsh: { name: "black_hole.fsh", label: "black_hole.fsh" },
    vsh: { name: "black_hole.vsh", label: "black_hole.vsh" },
    json: { name: "black_hole.json", label: "black_hole.json" },
  };

  let currentTemplateId = templateEl ? String(templateEl.value || "black_hole") : "black_hole";
  if (!TEMPLATES[currentTemplateId]) currentTemplateId = "black_hole";

  const state = {
    active: "fsh",
    files: {
      fsh: TEMPLATES[currentTemplateId].fsh,
      vsh: TEMPLATES[currentTemplateId].vsh,
      json: TEMPLATES[currentTemplateId].json,
    },
  };

  // ---------- editor ----------
  let lastActiveLine = -1;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setLog(text) {
    logEl.textContent = text || "";
  }

  function setLogVisible(visible) {
    if (!logWrapEl) return;
    logWrapEl.hidden = !visible;
  }

  function setStatus(text) {
    if (!statusEl) return;
    if (!text) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = text;
  }

  function setBackground(mode) {
    const all = ["bg-checker", "bg-black", "bg-white", "bg-green"];
    for (const cls of all) canvasWrapEl.classList.remove(cls);
    canvasWrapEl.classList.add(`bg-${mode}`);
  }

  function countLines(text) {
    if (!text) return 1;
    let count = 1;
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === "\n") count += 1;
    }
    return count;
  }

  function renderLineNumbers() {
    const total = countLines(codeEl.value);
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= total; i += 1) {
      const div = document.createElement("div");
      div.className = "shader-line-num";
      div.textContent = String(i);
      frag.appendChild(div);
    }
    linesEl.innerHTML = "";
    linesEl.appendChild(frag);
    lastActiveLine = -1;
    // keep active line styling after re-render
    scheduleActiveLineUpdate();
  }

  function renderHighlight() {
    if (!highlightEl) return;
    const raw = String(codeEl.value || "").replace(/\r\n/g, "\n");
    const rows = raw.split("\n");
    const html = rows.map((line) => {
      const safe = line === "" ? "&nbsp;" : escapeHtml(line);
      return `<div class="shader-code-line">${safe}</div>`;
    }).join("");
    highlightEl.innerHTML = html;
    scheduleActiveLineUpdate();
  }

  let syncScheduled = false;
  function syncScroll() {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      linesEl.scrollTop = codeEl.scrollTop;
      if (highlightEl) {
        highlightEl.scrollTop = codeEl.scrollTop;
        highlightEl.scrollLeft = codeEl.scrollLeft;
      }
      scheduleActiveLineUpdate();
    });
  }

  let activeLineScheduled = false;
  function scheduleActiveLineUpdate() {
    if (activeLineScheduled) return;
    activeLineScheduled = true;
    requestAnimationFrame(() => {
      activeLineScheduled = false;
      updateActiveLine();
    });
  }

  function computeLineIndexAt(pos) {
    const text = String(codeEl.value || "");
    const end = Math.max(0, Math.min(pos, text.length));
    let line = 1;
    for (let i = 0; i < end; i += 1) {
      if (text[i] === "\n") line += 1;
    }
    return line;
  }

  function updateActiveLine() {
    const pos = typeof codeEl.selectionStart === "number" ? codeEl.selectionStart : 0;
    const line = computeLineIndexAt(pos);

    if (lastActiveLine !== line) {
      const prev = linesEl.children[lastActiveLine - 1];
      if (prev) prev.classList.remove("is-active");
      const next = linesEl.children[line - 1];
      if (next) next.classList.add("is-active");

      if (highlightEl) {
        const prevCode = highlightEl.children[lastActiveLine - 1];
        if (prevCode) prevCode.classList.remove("is-active");
        const nextCode = highlightEl.children[line - 1];
        if (nextCode) nextCode.classList.add("is-active");
      }
      lastActiveLine = line;
    }
  }

  function updateStageHeight() {
    const style = getComputedStyle(codeEl);
    const lineHeightPx = parseFloat(style.lineHeight || "0") || 20;
    const paddingTopPx = parseFloat(style.paddingTop || "0") || 0;
    const paddingBottomPx = parseFloat(style.paddingBottom || "0") || 0;
    const stageHeight = STAGE_LINES * lineHeightPx + paddingTopPx + paddingBottomPx;
    root.style.setProperty("--shader-stage-height", `${Math.round(stageHeight)}px`);
    root.style.setProperty("--shader-line-height-px", `${Math.round(lineHeightPx)}px`);
    root.style.setProperty("--shader-editor-padding-top-px", `${Math.round(paddingTopPx)}px`);
    root.style.setProperty("--shader-editor-padding-bottom-px", `${Math.round(paddingBottomPx)}px`);
  }

  function setActiveFile(kind) {
    if (!FILE_META[kind]) return;
    state.files[state.active] = String(codeEl.value || "");
    state.active = kind;
    codeEl.value = state.files[kind];
    renderLineNumbers();
    renderHighlight();
    codeEl.scrollTop = 0;
    codeEl.scrollLeft = 0;
    syncScroll();
    scheduleActiveLineUpdate();
    updateStageHeight();

    for (const tab of fileTabs) {
      const isActive = tab.getAttribute("data-file-tab") === kind;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    if (fileHintEl) fileHintEl.textContent = `当前编辑：${FILE_META[kind].label}`;
  }

  // ---------- WebGL2 renderer ----------
  let gl = null;
  let program = null;
  let buffer = null;
  let texture0 = null;
  let startTime = 0;
  let rafId = 0;
  let pendingImage = null;

  const uniformLoc = {};

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function startLoop() {
    stopLoop();
    startTime = performance.now();
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      drawFrame();
    };
    tick();
  }

  function updateCanvasSize() {
    const rect = canvasWrapEl.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
    }
  }

  function initGl() {
    if (gl) return true;
    gl = canvasEl.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) {
      setStatus("需要 WebGL2 才能预览 Minecraft Core Shader。");
      return false;
    }

    // Fullscreen quad for Position/Color/UV0
    // [x,y,z,r,g,b,a,u,v] * 4
    const verts = new Float32Array([
      -1, -1, 0, 1, 1, 1, 1, 0, 0,
      1, -1, 0, 1, 1, 1, 1, 1, 0,
      -1, 1, 0, 1, 1, 1, 1, 0, 1,
      1, 1, 0, 1, 1, 1, 1, 1, 1,
    ]);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    texture0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255])
    );

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    setStatus("");
    return true;
  }

  function normalizeToWebGL2(source, kind) {
    const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let wroteVersion = false;
    let hasPrecision = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!wroteVersion && trimmed.startsWith("#version")) {
        out.push("#version 300 es");
        wroteVersion = true;
        continue;
      }
      if (trimmed.startsWith("#version")) continue;
      if (/^\s*precision\s+(lowp|mediump|highp)\s+float\s*;/.test(line)) {
        hasPrecision = true;
      }
      out.push(line);
    }

    if (!wroteVersion) out.unshift("#version 300 es");

    if (kind === "fragment" && !hasPrecision) {
      out.splice(1, 0, "precision highp float;", "precision highp int;");
    }
    if (kind === "vertex" && !hasPrecision) {
      out.splice(1, 0, "precision highp float;", "precision highp int;");
    }

    return out.join("\n");
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    const log = gl.getShaderInfoLog(shader) || "";
    return { shader, ok, log };
  }

  function linkProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    const ok = gl.getProgramParameter(p, gl.LINK_STATUS);
    const log = gl.getProgramInfoLog(p) || "";
    return { program: p, ok, log };
  }

  function parseJsonPipeline(text) {
    try {
      const obj = JSON.parse(String(text || ""));
      return obj && typeof obj === "object" ? obj : null;
    } catch {
      return null;
    }
  }

  function glBlendFactor(name) {
    const key = String(name || "").toLowerCase();
    const map = {
      zero: "ZERO",
      one: "ONE",
      src_color: "SRC_COLOR",
      one_minus_src_color: "ONE_MINUS_SRC_COLOR",
      dst_color: "DST_COLOR",
      one_minus_dst_color: "ONE_MINUS_DST_COLOR",
      src_alpha: "SRC_ALPHA",
      one_minus_src_alpha: "ONE_MINUS_SRC_ALPHA",
      dst_alpha: "DST_ALPHA",
      one_minus_dst_alpha: "ONE_MINUS_DST_ALPHA",
    };
    const glName = map[key];
    return glName ? gl[glName] : null;
  }

  function glBlendEquation(name) {
    const key = String(name || "").toLowerCase();
    const map = { add: "FUNC_ADD", subtract: "FUNC_SUBTRACT", reverse_subtract: "FUNC_REVERSE_SUBTRACT" };
    const glName = map[key];
    return glName ? gl[glName] : null;
  }

  function applyPipelineState(pipeline) {
    // defaults
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.STENCIL_TEST);

    if (pipeline && pipeline.blend) {
      const eq = glBlendEquation(pipeline.blend.func) ?? gl.FUNC_ADD;
      const src = glBlendFactor(pipeline.blend.srcfactor) ?? gl.SRC_ALPHA;
      const dst = glBlendFactor(pipeline.blend.dstfactor) ?? gl.ONE_MINUS_SRC_ALPHA;
      gl.enable(gl.BLEND);
      gl.blendEquation(eq);
      gl.blendFunc(src, dst);
    } else {
      gl.disable(gl.BLEND);
    }
  }

  function setUniformFromJson(item) {
    if (!item || typeof item !== "object") return;
    const name = String(item.name || "");
    if (!name) return;
    const loc = gl.getUniformLocation(program, name);
    if (!loc) return;

    const type = String(item.type || "");
    const values = Array.isArray(item.values) ? item.values : [];
    const count = Number(item.count || values.length || 0);

    if (type === "matrix4x4" && count === 16 && values.length >= 16) {
      gl.uniformMatrix4fv(loc, false, new Float32Array(values.slice(0, 16)));
      return;
    }

    if (type === "float") {
      if (count === 1) gl.uniform1f(loc, Number(values[0] ?? 0));
      if (count === 2) gl.uniform2f(loc, Number(values[0] ?? 0), Number(values[1] ?? 0));
      if (count === 3) gl.uniform3f(loc, Number(values[0] ?? 0), Number(values[1] ?? 0), Number(values[2] ?? 0));
      if (count === 4) gl.uniform4f(loc, Number(values[0] ?? 0), Number(values[1] ?? 0), Number(values[2] ?? 0), Number(values[3] ?? 0));
    }
  }

  function cacheUniformLocations(names) {
    for (const n of names) {
      uniformLoc[n] = gl.getUniformLocation(program, n);
    }
  }

  async function loadPendingImage() {
    const file = imageEl && imageEl.files && imageEl.files[0] ? imageEl.files[0] : null;
    if (!file) return false;
    if (!file.type || !file.type.startsWith("image/")) return false;

    setStatus("正在加载图片…");
    try {
      if ("createImageBitmap" in window) {
        pendingImage = await createImageBitmap(file);
        return true;
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
      });

      const img = new Image();
      img.decoding = "async";
      img.src = dataUrl;
      await img.decode();
      pendingImage = img;
      return true;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "加载图片失败");
      pendingImage = null;
      return false;
    }
  }

  function applyPendingImage() {
    if (!gl || !texture0 || !pendingImage) return;
    gl.bindTexture(gl.TEXTURE_2D, texture0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pendingImage);
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      if (pendingImage && typeof pendingImage.close === "function") pendingImage.close();
      pendingImage = null;
    }
  }

  function drawFrame() {
    if (!gl || !program) return;
    updateCanvasSize();
    gl.viewport(0, 0, canvasEl.width, canvasEl.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const stride = 9 * 4;
    const posLoc = gl.getAttribLocation(program, "Position");
    const colLoc = gl.getAttribLocation(program, "Color");
    const uvLoc = gl.getAttribLocation(program, "UV0");

    if (posLoc >= 0) {
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    }
    if (colLoc >= 0) {
      gl.enableVertexAttribArray(colLoc);
      gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, stride, 3 * 4);
    }
    if (uvLoc >= 0) {
      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, stride, 7 * 4);
    }

    // dynamic uniforms
    const t = (performance.now() - startTime) / 1000;
    if (uniformLoc.GameTime) gl.uniform1f(uniformLoc.GameTime, t);
    if (uniformLoc.ScreenSize) gl.uniform2f(uniformLoc.ScreenSize, canvasEl.width, canvasEl.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture0);
    if (uniformLoc.Sampler0) gl.uniform1i(uniformLoc.Sampler0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  async function reload() {
    if (!initGl()) return;
    reloadBtn.disabled = true;
    setLogVisible(false);
    setLog("Compiling…");

    state.files[state.active] = String(codeEl.value || "");
    await loadPendingImage();

    const pipeline = parseJsonPipeline(state.files.json);

    const vsSrc = normalizeToWebGL2(state.files.vsh, "vertex");
    const fsSrc = normalizeToWebGL2(state.files.fsh, "fragment");

    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);

    if (!vs.ok || !fs.ok) {
      const parts = [];
      if (!vs.ok) parts.push(`[Vertex Shader]\n${vs.log || "compile failed"}`);
      if (!fs.ok) parts.push(`[Fragment Shader]\n${fs.log || "compile failed"}`);
      setLog(parts.join("\n\n"));
      setLogVisible(true);
      setStatus("编译失败：请查看日志。");
      reloadBtn.disabled = false;
      return;
    }

    const linked = linkProgram(vs.shader, fs.shader);
    if (!linked.ok) {
      setLog(`[Link]\n${linked.log || "link failed"}`);
      setLogVisible(true);
      setStatus("链接失败：请查看日志。");
      reloadBtn.disabled = false;
      return;
    }

    program = linked.program;
    applyPipelineState(pipeline);

    cacheUniformLocations(["ModelViewMat", "ProjMat", "GameTime", "ColorModulator", "Sampler0", "ScreenSize"]);

    gl.useProgram(program);
    if (pipeline && Array.isArray(pipeline.uniforms)) {
      for (const u of pipeline.uniforms) setUniformFromJson(u);
    } else {
      // sensible defaults even without json
      const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      if (uniformLoc.ModelViewMat) gl.uniformMatrix4fv(uniformLoc.ModelViewMat, false, ident);
      if (uniformLoc.ProjMat) gl.uniformMatrix4fv(uniformLoc.ProjMat, false, ident);
      if (uniformLoc.ColorModulator) gl.uniform4f(uniformLoc.ColorModulator, 1, 1, 1, 1);
    }

    applyPendingImage();
    setStatus("");
    setLog("OK.");
    setLogVisible(false);
    reloadBtn.disabled = false;
    startLoop();
  }

  function applyTemplate(id) {
    const nextId = TEMPLATES[id] ? String(id) : "black_hole";
    currentTemplateId = nextId;
    if (templateEl) templateEl.value = nextId;

    const tpl = TEMPLATES[nextId];
    const names = templateFileNames(nextId);

    FILE_META.fsh.name = names.fsh;
    FILE_META.vsh.name = names.vsh;
    FILE_META.json.name = names.json;
    FILE_META.fsh.label = names.fsh;
    FILE_META.vsh.label = names.vsh;
    FILE_META.json.label = names.json;

    for (const tab of fileTabs) {
      const kind = String(tab.getAttribute("data-file-tab") || "");
      if (kind === "fsh") tab.textContent = names.fsh;
      if (kind === "vsh") tab.textContent = names.vsh;
      if (kind === "json") tab.textContent = names.json;
    }

    state.files = { fsh: tpl.fsh, vsh: tpl.vsh, json: tpl.json };
    setActiveFile("fsh");
    setLogVisible(false);
    setLog(`（已应用模板：${tpl.label}）`);
  }

  function resetTemplate() {
    const id = templateEl ? String(templateEl.value || currentTemplateId) : currentTemplateId;
    applyTemplate(id);
  }

  async function importShaderFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    const readAsText = async (file) => {
      const buf = await file.arrayBuffer();
      return new TextDecoder("utf-8").decode(buf);
    };

    for (const f of list) {
      const name = String(f.name || "").toLowerCase();
      const text = await readAsText(f);
      if (name.endsWith(".vsh")) state.files.vsh = text;
      else if (name.endsWith(".fsh")) state.files.fsh = text;
      else if (name.endsWith(".json")) state.files.json = text;
    }

    // keep current editor content synced
    setActiveFile(state.active);
  }

  // init UI
  applyTemplate(currentTemplateId);
  setBackground("checker");
  if (bgEl) bgEl.addEventListener("change", () => setBackground(String(bgEl.value || "checker")));

  for (const tab of fileTabs) {
    tab.addEventListener("click", () => setActiveFile(String(tab.getAttribute("data-file-tab") || "")));
  }

  codeEl.addEventListener("input", () => {
    state.files[state.active] = String(codeEl.value || "");
    renderLineNumbers();
    renderHighlight();
    syncScroll();
    scheduleActiveLineUpdate();
    updateStageHeight();
  });
  codeEl.addEventListener("click", scheduleActiveLineUpdate);
  codeEl.addEventListener("keyup", scheduleActiveLineUpdate);
  codeEl.addEventListener("select", scheduleActiveLineUpdate);
  codeEl.addEventListener("scroll", syncScroll);

  reloadBtn.addEventListener("click", reload);
  resetBtn.addEventListener("click", async () => {
    resetTemplate();
    await reload();
  });

  if (applyTemplateBtn && templateEl) {
    applyTemplateBtn.addEventListener("click", async () => {
      applyTemplate(String(templateEl.value || "black_hole"));
      await reload();
    });
  }

  if (shaderFilesEl) {
    shaderFilesEl.addEventListener("change", async () => {
      try {
        await importShaderFiles(shaderFilesEl.files);
        await reload();
      } catch {
        setStatus("导入 shader 文件失败。");
      } finally {
        shaderFilesEl.value = "";
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      reload();
    }
  });

  const ro = "ResizeObserver" in window ? new ResizeObserver(() => updateCanvasSize()) : null;
  if (ro) ro.observe(canvasWrapEl);
  window.addEventListener("resize", updateCanvasSize);
  window.addEventListener("resize", updateStageHeight);

  // Fonts can load after initial paint and change line metrics.
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(() => {
      updateStageHeight();
      syncScroll();
      scheduleActiveLineUpdate();
    });
  }
  window.setTimeout(() => {
    updateStageHeight();
    syncScroll();
    scheduleActiveLineUpdate();
  }, 120);

  reload();
})();

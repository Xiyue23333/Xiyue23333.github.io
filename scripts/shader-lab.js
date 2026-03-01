(function () {
  const root = document.querySelector("[data-shader-lab]");
  if (!root) return;

  const codeEl = root.querySelector("[data-code]");
  const linesEl = root.querySelector("[data-lines]");
  const logEl = root.querySelector("[data-log]");
  const logWrapEl = root.querySelector("[data-log-wrap]");
  const imageEl = root.querySelector("[data-image]");
  const shaderFilesEl = root.querySelector("[data-shader-files]");
  const bgEl = root.querySelector("[data-bg]");
  const canvasWrapEl = root.querySelector("[data-canvas-wrap]");
  const canvasEl = root.querySelector("[data-canvas]");
  const statusEl = root.querySelector("[data-canvas-status]");
  const reloadBtn = root.querySelector("[data-action='reload']");
  const resetBtn = root.querySelector("[data-action='reset']");
  const fileHintEl = root.querySelector("[data-filehint]");
  const fileTabs = Array.from(root.querySelectorAll("[data-file-tab]"));

  if (!codeEl || !linesEl || !logEl || !canvasEl || !canvasWrapEl || !reloadBtn || !resetBtn) return;

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

  const FILE_META = {
    fsh: { name: "black_hole.fsh", label: "black_hole.fsh", template: TEMPLATE_FSH },
    vsh: { name: "black_hole.vsh", label: "black_hole.vsh", template: TEMPLATE_VSH },
    json: { name: "black_hole.json", label: "black_hole.json", template: TEMPLATE_JSON },
  };

  const state = {
    active: "fsh",
    files: {
      fsh: TEMPLATE_FSH,
      vsh: TEMPLATE_VSH,
      json: TEMPLATE_JSON,
    },
  };

  // ---------- editor ----------
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
  }

  let syncScheduled = false;
  function syncScroll() {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      linesEl.scrollTop = codeEl.scrollTop;
    });
  }

  function setActiveFile(kind) {
    if (!FILE_META[kind]) return;
    state.files[state.active] = String(codeEl.value || "");
    state.active = kind;
    codeEl.value = state.files[kind];
    renderLineNumbers();
    codeEl.scrollTop = 0;
    codeEl.scrollLeft = 0;
    syncScroll();

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

  function resetTemplate() {
    state.files = {
      fsh: FILE_META.fsh.template,
      vsh: FILE_META.vsh.template,
      json: FILE_META.json.template,
    };
    setActiveFile("fsh");
    setLog("（已重置模板）");
    setLogVisible(false);
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
  codeEl.value = state.files[state.active];
  renderLineNumbers();
  syncScroll();
  setBackground("checker");
  if (bgEl) bgEl.addEventListener("change", () => setBackground(String(bgEl.value || "checker")));

  for (const tab of fileTabs) {
    tab.addEventListener("click", () => setActiveFile(String(tab.getAttribute("data-file-tab") || "")));
  }

  codeEl.addEventListener("input", () => {
    state.files[state.active] = String(codeEl.value || "");
    renderLineNumbers();
    syncScroll();
  });
  codeEl.addEventListener("scroll", syncScroll);

  reloadBtn.addEventListener("click", reload);
  resetBtn.addEventListener("click", async () => {
    resetTemplate();
    await reload();
  });

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

  reload();
})();

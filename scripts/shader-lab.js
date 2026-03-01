(function () {
  const root = document.querySelector("[data-shader-lab]");
  if (!root) return;

  const codeEl = root.querySelector("[data-code]");
  const linesEl = root.querySelector("[data-lines]");
  const logEl = root.querySelector("[data-log]");
  const imageEl = root.querySelector("[data-image]");
  const bgEl = root.querySelector("[data-bg]");
  const canvasWrapEl = root.querySelector("[data-canvas-wrap]");
  const canvasEl = root.querySelector("[data-canvas]");
  const statusEl = root.querySelector("[data-canvas-status]");
  const reloadBtn = root.querySelector("[data-action='reload']");
  const resetBtn = root.querySelector("[data-action='reset']");

  if (!codeEl || !linesEl || !logEl || !canvasEl || !canvasWrapEl || !reloadBtn || !resetBtn) return;

  const TEMPLATE = `#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_texture;

varying vec2 v_uv;

void main() {
  vec2 uv = v_uv;
  vec4 tex = texture2D(u_texture, uv);

  float wave = 0.02 * sin(uv.y * 18.0 + u_time * 2.0);
  vec2 uv2 = uv + vec2(wave, 0.0);
  vec3 col = texture2D(u_texture, uv2).rgb;

  float vignette = smoothstep(0.95, 0.35, distance(uv, vec2(0.5)));
  col *= mix(0.78, 1.12, vignette);

  gl_FragColor = vec4(col, tex.a);
}
`;

  const VERTEX_SRC = `attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  let gl = null;
  let program = null;
  let buffer = null;
  let uniformResolution = null;
  let uniformTime = null;
  let uniformTexture = null;
  let startTime = 0;
  let rafId = 0;
  let texture = null;
  let pendingImageBitmap = null;

  function setLog(text) {
    logEl.textContent = text || "";
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

  function initGl() {
    if (gl) return true;
    gl = canvasEl.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) {
      setStatus("当前浏览器不支持 WebGL。");
      return false;
    }

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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

    setStatus("");
    return true;
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

  function drawFrame() {
    if (!gl || !program) return;
    updateCanvasSize();
    gl.viewport(0, 0, canvasEl.width, canvasEl.height);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    if (uniformResolution) gl.uniform2f(uniformResolution, canvasEl.width, canvasEl.height);
    if (uniformTime) gl.uniform1f(uniformTime, (performance.now() - startTime) / 1000);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (uniformTexture) gl.uniform1i(uniformTexture, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  async function loadPendingImage() {
    const file = imageEl && imageEl.files && imageEl.files[0] ? imageEl.files[0] : null;
    if (!file) return false;
    if (!file.type || !file.type.startsWith("image/")) return false;

    setStatus("正在加载图片…");
    try {
      if ("createImageBitmap" in window) {
        pendingImageBitmap = await createImageBitmap(file);
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
      pendingImageBitmap = img;
      return true;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "加载图片失败");
      pendingImageBitmap = null;
      return false;
    }
  }

  function applyImageBitmap() {
    if (!gl || !texture || !pendingImageBitmap) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pendingImageBitmap);
    } catch {
      // Some browsers may reject ImageBitmap in rare cases; fallback to 1x1 white.
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
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

    if (pendingImageBitmap && typeof pendingImageBitmap.close === "function") {
      pendingImageBitmap.close();
    }
    pendingImageBitmap = null;
  }

  async function reload() {
    if (!initGl()) return;
    reloadBtn.disabled = true;
    setLog("正在编译…");

    await loadPendingImage();

    const fsSrc = String(codeEl.value || "");
    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);

    if (!vs.ok || !fs.ok) {
      const parts = [];
      if (!vs.ok) parts.push(`[Vertex Shader]\n${vs.log || "编译失败（无日志）"}`);
      if (!fs.ok) parts.push(`[Fragment Shader]\n${fs.log || "编译失败（无日志）"}`);
      setLog(parts.join("\n\n"));
      setStatus("编译失败：请查看日志。");
      reloadBtn.disabled = false;
      return;
    }

    const linked = linkProgram(vs.shader, fs.shader);
    if (!linked.ok) {
      setLog(`[Link]\n${linked.log || "链接失败（无日志）"}`);
      setStatus("链接失败：请查看日志。");
      reloadBtn.disabled = false;
      return;
    }

    program = linked.program;
    uniformResolution = gl.getUniformLocation(program, "u_resolution");
    uniformTime = gl.getUniformLocation(program, "u_time");
    uniformTexture = gl.getUniformLocation(program, "u_texture");

    applyImageBitmap();
    setStatus("");
    setLog("编译成功。");
    reloadBtn.disabled = false;
    startLoop();
  }

  function resetTemplate() {
    codeEl.value = TEMPLATE;
    renderLineNumbers();
    codeEl.scrollTop = 0;
    codeEl.scrollLeft = 0;
    syncScroll();
  }

  // init UI
  resetTemplate();
  renderLineNumbers();
  setBackground("checker");
  bgEl && bgEl.addEventListener("change", () => setBackground(String(bgEl.value || "checker")));

  codeEl.addEventListener("input", () => {
    renderLineNumbers();
    syncScroll();
  });
  codeEl.addEventListener("scroll", syncScroll);

  reloadBtn.addEventListener("click", reload);
  resetBtn.addEventListener("click", async () => {
    resetTemplate();
    await reload();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      reload();
    }
  });

  const ro = "ResizeObserver" in window ? new ResizeObserver(() => updateCanvasSize()) : null;
  if (ro) ro.observe(canvasWrapEl);
  window.addEventListener("resize", updateCanvasSize);

  // First run
  reload();
})();

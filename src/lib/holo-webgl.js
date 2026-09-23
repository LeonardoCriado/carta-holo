/*
 * WebGL overlay del efecto holo (modo "Motor: WebGL").
 *
 * A diferencia del modo CSS (capas shine/glare con mix-blend-mode, que
 * repintan por CPU y no llegan a 60fps en el celular), acá se compone
 * TODO en el shader: carta + arcoíris + texturas + glare, con las mismas
 * ecuaciones de blend de la referencia (color-dodge, hard-light,
 * luminosity, exclusion…). Es el equivalente web a lo que TiltHologramCard
 * hace con Skia: un solo quad en GPU, sin layout ni repaint.
 * El canvas es opaco y tapa al <img>; si WebGL falla, queda el CSS.
 */

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_pointer;
uniform vec2 u_background;
uniform float u_center;
uniform vec2 u_resolution;
uniform int u_effect;
uniform sampler2D u_card;
uniform sampler2D u_glitter;
uniform sampler2D u_illusion;
uniform sampler2D u_cosmos_bottom;
uniform sampler2D u_cosmos_middle;
uniform sampler2D u_cosmos_top;
uniform sampler2D u_vmax;

float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

/* Paleta del holo clásico (vars --red/--yellow/--green/--blue/--violet) */
vec3 rainbow5(float t) {
  vec3 c1 = vec3(0.788, 0.161, 0.945);
  vec3 c2 = vec3(0.051, 0.741, 0.914);
  vec3 c3 = vec3(0.129, 0.914, 0.522);
  vec3 c4 = vec3(0.933, 0.875, 0.063);
  vec3 c5 = vec3(0.973, 0.055, 0.208);
  float seg = fract(t) * 5.0;
  float idx = floor(seg);
  float f = fract(seg);
  vec3 a = c1;
  vec3 b = c2;
  if (idx > 0.5 && idx <= 1.5) { a = c2; b = c3; }
  else if (idx > 1.5 && idx <= 2.5) { a = c3; b = c4; }
  else if (idx > 2.5 && idx <= 3.5) { a = c4; b = c5; }
  else if (idx > 3.5) { a = c5; b = c1; }
  return mix(a, b, f);
}

vec3 fContrast(vec3 c, float k) { return (c - 0.5) * k + 0.5; }
vec3 fSaturate(vec3 c, float s) { return mix(vec3(luminance(c)), c, s); }

vec3 bScreen(vec3 b, vec3 s) { return 1.0 - (1.0 - b) * (1.0 - s); }

vec3 bOverlay(vec3 b, vec3 s) {
  vec3 a = 2.0 * b * s;
  vec3 d = 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
  return mix(a, d, step(vec3(0.5), b));
}

vec3 bHardLight(vec3 b, vec3 s) { return bOverlay(s, b); }

vec3 bColorDodge(vec3 b, vec3 s) {
  vec3 d = b / max(1.0 - s, vec3(0.004));
  d = min(d, vec3(1.0));
  return mix(d, vec3(1.0), step(vec3(0.999), s));
}

vec3 bExclusion(vec3 b, vec3 s) { return b + s - 2.0 * b * s; }
vec3 bDifference(vec3 b, vec3 s) { return abs(b - s); }
vec3 bLighten(vec3 b, vec3 s) { return max(b, s); }

vec3 bLuminosity(vec3 b, vec3 s) {
  return clamp(b + (luminance(s) - luminance(b)), 0.0, 1.0);
}

/* source-over con color opaco == mix() */
vec3 over(vec3 dst, vec3 blended, float a) {
  return mix(dst, blended, clamp(a, 0.0, 1.0));
}

float angleBands(vec2 uv, float angle, float scale, vec2 offset) {
  float r = radians(angle);
  vec2 p = uv - 0.5;
  float axis = p.x * cos(r) - p.y * sin(r);
  return fract(axis * scale + offset.x + offset.y);
}

float radial(vec2 uv, vec2 point, float radius) {
  vec2 d = (uv - point) * vec2(u_resolution.x / u_resolution.y, 1.0);
  return 1.0 - smoothstep(0.0, radius, length(d));
}

void main() {
  // CSS y el sensor expresan Y desde arriba; WebGL interpola Y desde abajo.
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 bg = u_background - 0.5;
  float glow = radial(uv, u_pointer, 1.15);
  float edge = smoothstep(0.0, 0.85, u_center);
  vec3 card = texture2D(u_card, uv).rgb;
  vec3 col = card;

  if (u_effect == 0) {
    // Rare holo: arcoíris 110° + scanlines (overlay interno) → color-dodge
    float phase = angleBands(uv, 110.0, 4.0, vec2(bg.x * 2.6 + bg.y * 3.5));
    vec3 grad = rainbow5(phase * 3.0);
    float scan = step(0.5, fract(uv.y * u_resolution.y / 4.0));
    grad = bOverlay(grad, vec3(mix(0.35, 1.0, scan)));
    grad = fContrast(fSaturate(grad * 1.1, 1.2), 1.1);
    grad *= 0.8 + edge * 0.35;
    col = over(col, bColorDodge(col, clamp(grad, 0.0, 1.0)), 0.9);
    // ::before: barras cruzadas → hard-light
    float barA = step(0.72, fract(uv.x * 15.0 + bg.y * 2.4));
    float barB = step(0.72, fract(uv.x * 15.0 - bg.y * 2.4));
    vec3 bars = fContrast(bScreen(vec3(barA * 0.9), vec3(barB * 0.9)) * 1.15, 1.1);
    col = over(col, bHardLight(col, clamp(bars, 0.0, 1.0)), 0.9);
    // ::after: reflejo blanco → luminosity
    vec3 luml = fContrast(mix(vec3(0.0), vec3(0.9), vec3(glow)) * 0.6, 4.0);
    col = over(col, bLuminosity(col, clamp(luml, 0.0, 1.0)), 0.9);
    // glare → overlay
    vec3 g = mix(vec3(0.05), vec3(1.0), vec3(glow));
    col = over(col, bOverlay(col, clamp(g, 0.0, 1.0)), 0.8);
  } else if (u_effect == 1) {
    // Cosmos: estrellas + arcoíris 82° → color-dodge, glare overlay
    vec3 stars = texture2D(u_cosmos_bottom, uv).rgb
      + texture2D(u_cosmos_middle, uv).rgb
      + texture2D(u_cosmos_top, uv).rgb;
    float phase = angleBands(uv, 82.0, 4.0, vec2(bg.x + bg.y));
    vec3 grad = fSaturate(rainbow5(phase * 2.0), 0.6);
    vec3 foil = clamp(mix(grad, clamp(stars, 0.0, 1.0), 0.72), 0.0, 1.0);
    foil *= 0.8 + edge * 0.3 + glow * 0.2;
    col = over(col, bColorDodge(col, foil), 0.9);
    vec3 g = mix(vec3(0.02, 0.02, 0.05), vec3(0.9, 0.95, 1.0), vec3(glow));
    col = over(col, bOverlay(col, clamp(g, 0.0, 1.0)), 0.7);
  } else if (u_effect == 2) {
    // Shiny V: foil ilusión + sunpillar → exclusion, sheen overlay
    vec3 foilTex = texture2D(u_illusion, fract(uv * 3.0 + bg)).rgb;
    float phase = angleBands(uv, 0.0, 2.0, vec2(bg.y * 3.0));
    vec3 foil = clamp(mix(rainbow5(phase * 2.0), foilTex, 0.55), 0.0, 1.0);
    foil = fContrast(fSaturate(foil * (0.75 + edge * 0.4), 1.5), 2.0);
    col = over(col, bExclusion(col, clamp(foil, 0.0, 1.0)), 0.95);
    vec3 sheen = mix(vec3(0.2), vec3(1.0), vec3(glow));
    col = over(col, bOverlay(col, clamp(sheen, 0.0, 1.0)), 0.6);
  } else if (u_effect == 3) {
    // Arcoíris: glitter + arcoíris → color-dodge, glare overlay
    vec3 glit = texture2D(u_glitter, fract(uv * 4.0)).rgb;
    float phase = angleBands(uv, -30.0, 4.0, vec2(bg.x + bg.y));
    vec3 foil = clamp(mix(fSaturate(rainbow5(phase * 3.0), 0.8), glit, 0.34), 0.0, 1.0);
    foil = fContrast(foil * (0.8 + edge * 0.35), 2.2);
    col = over(col, bColorDodge(col, foil), 0.95);
    vec3 g = mix(vec3(0.05), vec3(1.0), vec3(glow));
    col = over(col, bOverlay(col, clamp(g, 0.0, 1.0)), 0.75);
  } else {
    // VMAX: foil vs arcoíris en difference (interno) → color-dodge + lighten
    vec3 foilTex = texture2D(u_vmax, fract(uv * vec2(1.66, 3.33) + bg)).rgb;
    float phase = angleBands(uv, -33.0, 6.0, vec2(bg.x * 2.0 + bg.y * 2.0));
    vec3 inner = bDifference(clamp(foilTex, 0.0, 1.0), clamp(rainbow5(phase * 2.0), 0.0, 1.0));
    inner = fSaturate(inner, 1.2) * (0.7 + edge * 0.4);
    col = over(col, bColorDodge(col, clamp(inner, 0.0, 1.0)), 0.95);
    vec3 sun = rainbow5(phase + 0.35) * (0.5 + edge * 0.5);
    col = over(col, bLighten(col, clamp(sun, 0.0, 1.0)), 0.5);
    vec3 g = mix(vec3(0.0), vec3(1.0), vec3(glow));
    col = over(col, bOverlay(col, clamp(g, 0.0, 1.0)), 0.85);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const EFFECTS = {
  "rare holo": 0,
  "rare holo cosmos": 1,
  "rare shiny v": 2,
  "rare rainbow": 3,
  "rare holo vmax": 4,
};

function shader(gl, type, source) {
  const value = gl.createShader(type);
  gl.shaderSource(value, source);
  gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(value));
    gl.deleteShader(value);
    return null;
  }
  return value;
}

function texture(gl, url) {
  const value = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, value);
  // WebGL1 no permite REPEAT en texturas NPOT; todas las texturas de la
  // carta son NPOT y se muestrean con coordenadas fract() igualmente.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const image = new Image();
  const ready = new Promise((resolve, reject) => {
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, value);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      resolve();
    };
    image.onerror = reject;
  });
  image.src = url;
  return { value, ready };
}

export function createHoloGL(canvas, onReady) {
  if (!canvas) return null;
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const u = {
    pointer: uniform("u_pointer"),
    background: uniform("u_background"),
    center: uniform("u_center"),
    resolution: uniform("u_resolution"),
    effect: uniform("u_effect"),
  };
  // import.meta.env.BASE_URL respeta el `base` de Vite ("/" en dev,
  // "/carta-holo/" en GitHub Pages): las rutas absolutas "/assets/…"
  // darían 404 bajo un subpath.
  const base = import.meta.env?.BASE_URL ?? "/";
  const paths = [
    ["card", `${base}assets/card.png`],
    ["glitter", `${base}assets/glitter.png`],
    ["illusion", `${base}assets/illusion.png`],
    ["cosmos_bottom", `${base}assets/cosmos-bottom.png`],
    ["cosmos_middle", `${base}assets/cosmos-middle-trans.png`],
    ["cosmos_top", `${base}assets/cosmos-top-trans.png`],
    ["vmax", `${base}assets/vmaxbg.jpg`],
  ];
  const textures = paths.map(([name, path], index) => {
    const item = texture(gl, path);
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, item.value);
    gl.uniform1i(uniform(`u_${name}`), index);
    return item;
  });

  let pointer = [0.5, 0.5];
  let background = [0.5, 0.5];
  let center = 0;
  let effect = 0;
  let ready = false;

  const render = () => {
    if (!ready) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.pointer, pointer[0], pointer[1]);
    gl.uniform2f(u.background, background[0], background[1]);
    gl.uniform1f(u.center, center);
    gl.uniform2f(u.resolution, canvas.width, canvas.height);
    gl.uniform1i(u.effect, effect);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    render();
  };

  const update = ({ x, y, fromCenter }) => {
    pointer = [x / 100, y / 100];
    background = [0.37 + (x / 100) * 0.26, 0.33 + (y / 100) * 0.34];
    center = fromCenter;
    render();
  };

  const setEffect = (name) => {
    if (EFFECTS[name] === undefined) return;
    effect = EFFECTS[name];
    render();
  };

  Promise.all(textures.map((item) => item.ready))
    .then(() => {
      ready = true;
      onReady?.();
      resize();
      render();
    })
    .catch((error) => console.error("No se pudieron cargar las texturas WebGL", error));

  return { resize, update, setEffect };
}

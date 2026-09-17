/*
 * WebGL overlay del efecto holo.
 *
 * La imagen original permanece como capa base; este canvas solo calcula el
 * brillo por píxel. Así se evita repintar cuatro capas CSS sin degradar la
 * nitidez de la carta. Si WebGL o una textura no están disponibles, el
 * llamador conserva el efecto CSS.
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
uniform sampler2D u_glitter;
uniform sampler2D u_illusion;
uniform sampler2D u_cosmos_bottom;
uniform sampler2D u_cosmos_middle;
uniform sampler2D u_cosmos_top;
uniform sampler2D u_vmax;

float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 hsv(vec3 c) {
  vec4 k = vec4(1.0, 0.6666667, 0.3333333, 3.0);
  vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
  return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
}

vec3 sunpillar(float t) {
  vec3 c1 = vec3(1.0, 0.48, 0.43);
  vec3 c2 = vec3(1.0, 0.93, 0.41);
  vec3 c3 = vec3(0.64, 1.0, 0.42);
  vec3 c4 = vec3(0.42, 1.0, 0.98);
  vec3 c5 = vec3(0.45, 0.58, 1.0);
  vec3 c6 = vec3(0.84, 0.45, 1.0);
  t = fract(t);
  float segment = t * 6.0;
  float index = floor(segment);
  float f = fract(segment);
  vec3 a = c1;
  vec3 b = c2;
  if (index >= 1.0) { a = c2; b = c3; }
  if (index >= 2.0) { a = c3; b = c4; }
  if (index >= 3.0) { a = c4; b = c5; }
  if (index >= 4.0) { a = c5; b = c6; }
  if (index >= 5.0) { a = c6; b = c1; }
  return mix(a, b, smoothstep(0.0, 1.0, f));
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

vec3 overlay(vec3 base, vec3 layer) {
  return mix(2.0 * base * layer,
    1.0 - 2.0 * (1.0 - base) * (1.0 - layer),
    step(0.5, base));
}

void main() {
  vec2 uv = v_uv;
  vec2 bg = u_background - 0.5;
  float glow = radial(uv, u_pointer, 1.15);
  float edge = smoothstep(0.0, 0.85, u_center);
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  if (u_effect == 0) {
    // Regular holo de pokemon-cards-css: --holo, 400% de fondo y overlay.
    float phase = angleBands(uv, 10.0, 3.8, vec2(bg.x + bg.y));
    color = sunpillar(phase);
    color = (color - 0.5) * 3.0 + 0.5;
    color = clamp(color, 0.0, 1.0);

    // Las dos capas de barras cruzadas del ::before.
    float barA = step(0.72, fract(uv.x * 15.0 + bg.y * 2.4));
    float barB = step(0.72, fract(uv.x * 15.0 - bg.y * 2.4));
    float bars = max(barA, barB) * 0.35;
    color = mix(color, vec3(0.92), bars);

    // ::after y glare: reflejo blanco que sigue al punto de observación.
    color = mix(color, vec3(0.95), glow * 0.36);
    alpha = 0.52 + edge * 0.25 + glow * 0.2;
  } else if (u_effect == 1) {
    vec4 stars = texture2D(u_cosmos_bottom, uv);
    stars += texture2D(u_cosmos_middle, uv);
    stars += texture2D(u_cosmos_top, uv);
    float phase = angleBands(uv, 82.0, 4.0, vec2(bg.x + bg.y));
    color = mix(hsv(vec3(phase, 0.7, 0.9)), stars.rgb, 0.72);
    alpha = 0.18 + edge * 0.25 + glow * 0.22;
  } else if (u_effect == 2) {
    vec3 foil = texture2D(u_illusion, fract(uv * 3.0 + bg)).rgb;
    float phase = angleBands(uv, 0.0, 2.0, vec2(bg.y * 3.0));
    color = mix(hsv(vec3(phase, 0.78, 1.0)), foil, 0.55);
    alpha = 0.12 + edge * 0.25 + glow * 0.18;
  } else if (u_effect == 3) {
    vec3 glitter = texture2D(u_glitter, fract(uv * 4.0)).rgb;
    float phase = angleBands(uv, -30.0, 4.0, vec2(bg.x + bg.y));
    color = mix(hsv(vec3(phase, 0.72, 0.9)), glitter, 0.34);
    alpha = 0.12 + edge * 0.24 + glow * 0.22;
  } else {
    vec3 foil = texture2D(u_vmax, fract(uv * vec2(1.66, 3.33) + bg)).rgb;
    float phase = angleBands(uv, -33.0, 6.0, vec2(bg.x * 2.0 + bg.y * 2.0));
    color = mix(hsv(vec3(phase, 0.78, 0.95)), foil, 0.65);
    alpha = 0.14 + edge * 0.27 + glow * 0.24;
  }

  color = clamp(color * (0.72 + edge * 0.3) + vec3(glow * 0.16), 0.0, 1.0);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.62));
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
  const paths = [
    ["glitter", "/assets/glitter.png"],
    ["illusion", "/assets/illusion.png"],
    ["cosmos_bottom", "/assets/cosmos-bottom.png"],
    ["cosmos_middle", "/assets/cosmos-middle-trans.png"],
    ["cosmos_top", "/assets/cosmos-top-trans.png"],
    ["vmax", "/assets/vmaxbg.jpg"],
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

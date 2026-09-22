import "./styles/app.css";
import "./styles/card.css";
import "./styles/effects.css";
import { createHoloController } from "./lib/orientation.js";
import { createHoloGL } from "./lib/holo-webgl.js";

const card = document.getElementById("carta");
const estado = document.getElementById("estado-sensores");
const btnRecentrar = document.getElementById("btn-recentrar");
const botonesEfecto = document.querySelectorAll(".efecto");

const setEstado = (tipo, mensaje) => {
  estado.textContent = mensaje;
  estado.classList.toggle("ok", tipo === "ok");
  estado.classList.toggle("error", tipo === "error");
};

const canvasGL = document.querySelector(".card__gl");
const btnMotor = document.getElementById("btn-motor");

// Motor del brillo conmutable: CSS puro (shine/glare) o canvas WebGL.
// La clase `gl-active` oculta el CSS y muestra el canvas (ver card.css).
let useGL = localStorage.getItem("holo-motor") !== "css";
let glReady = false;
const applyMotor = () => {
  card.classList.toggle("gl-active", useGL && glReady);
  btnMotor.textContent = `Motor: ${useGL ? "WebGL" : "CSS"}`;
};
const gl = createHoloGL(canvasGL, () => {
  glReady = true;
  applyMotor();
});
if (!gl && btnMotor) btnMotor.hidden = true;
const controller = createHoloController(card, {
  onStatus: setEstado,
  // en modo CSS no se actualiza el canvas oculto (ahorra GPU)
  onUpdate: (v) => {
    if (useGL) gl?.update(v);
  },
});
controller.start();
applyMotor();

btnMotor?.addEventListener("click", () => {
  useGL = !useGL;
  localStorage.setItem("holo-motor", useGL ? "webgl" : "css");
  if (useGL) gl?.resize(); // repinta el canvas con los últimos valores
  applyMotor();
});

if (gl) {
  const resizeObserver = new ResizeObserver(gl.resize);
  resizeObserver.observe(card);
}

// Selector de efecto holo
botonesEfecto.forEach((btn) => {
  btn.addEventListener("click", () => {
    botonesEfecto.forEach((b) => b.classList.remove("activo"));
    btn.classList.add("activo");
    card.dataset.rarity = btn.dataset.effect;
    gl?.setEffect(btn.dataset.effect);
  });
});

// Recentrar: la posición actual del teléfono pasa a ser el centro
btnRecentrar.addEventListener("click", () => {
  controller.recenter();
  setEstado("ok", "Centro recalibrado");
});

// Modo fullscreen: tap en la carta maximiza sin controles; tap de nuevo sale.
// Se ignora el tap si hubo arrastre (probar el holo no debe maximizar).
const btnSalir = document.getElementById("btn-salir-fullscreen");

const setFullscreen = (activo) => {
  document.body.classList.toggle("fullscreen", activo);
  btnSalir.hidden = !activo;
};

let downPos = null;
card.addEventListener("pointerdown", (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});
card.addEventListener("click", (e) => {
  if (downPos) {
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    downPos = null;
    if (Math.hypot(dx, dy) > 8) return; // fue arrastre, no tap
  }
  const activo = !document.body.classList.contains("fullscreen");
  setFullscreen(activo);
  // Fullscreen API real: oculta la barra del navegador (requiere gesto del usuario)
  if (activo && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (!activo && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
});

btnSalir.addEventListener("click", () => {
  setFullscreen(false);
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
});

// Si el usuario sale con el botón atrás del sistema, sincronizar el estado
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) setFullscreen(false);
});

// Service worker (solo en contexto seguro: https o localhost)
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // el SW es opcional para la PoC; ignorar errores de registro
    });
  });
}

import { clamp, round, adjust } from "./math.js";

// Grados de inclinación que recorren todo el rango del efecto
const LIMIT_X = 16; // izquierda/derecha
const LIMIT_Y = 18; // adelante/atrás

// Velocidad de persecución del suavizado (por segundo)
const SMOOTHING = 8;

/**
 * Controla las variables CSS del efecto holo de una carta a partir de la
 * orientación del dispositivo (giroscopio), con fallback a puntero
 * (mouse/táctil) para escritorio o dispositivos sin sensores.
 *
 * La carta permanece fija: solo se desplazan brillos, arcoíris y reflejos,
 * como al mirar una carta holo real desde distintos ángulos.
 *
 * @param {HTMLElement} card elemento .card al que se le aplican las variables
 * @param {{ onStatus?: (tipo: "ok" | "info" | "error", mensaje: string) => void }} opciones
 */
export function createHoloController(card, { onStatus } = {}) {
  // posición objetivo (0-100) y posición suavizada actual
  const target = { x: 50, y: 50 };
  const current = { x: 50, y: 50 };

  /** @type {{ x: number, y: number } | null} orientación de referencia (calibración) */
  let base = null;
  let rafId = null;
  let lastTime = 0;
  let sensorActivo = false;
  let usandoPuntero = false;
  let iniciado = false;

  const necesitaPermiso =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function";

  /** Escribe las variables CSS de la carta a partir de la posición actual. */
  const aplicarVars = () => {
    const px = clamp(current.x);
    const py = clamp(current.y);
    const desdeCentro = clamp(Math.hypot(px - 50, py - 50) / 50, 0, 1);

    card.style.setProperty("--pointer-x", `${round(px)}%`);
    card.style.setProperty("--pointer-y", `${round(py)}%`);
    card.style.setProperty("--pointer-from-center", round(desdeCentro));
    card.style.setProperty("--pointer-from-top", round(py / 100));
    card.style.setProperty("--pointer-from-left", round(px / 100));
    card.style.setProperty("--background-x", `${round(adjust(px, 0, 100, 37, 63))}%`);
    card.style.setProperty("--background-y", `${round(adjust(py, 0, 100, 33, 67))}%`);
    card.style.setProperty("--card-opacity", "1");
  };

  /** Bucle de animación con suavizado exponencial (independiente de FPS). */
  const tick = (t) => {
    const dt = Math.min((t - lastTime) / 1000, 0.1);
    lastTime = t;
    const k = 1 - Math.exp(-SMOOTHING * dt);
    current.x += (target.x - current.x) * k;
    current.y += (target.y - current.y) * k;
    aplicarVars();
    rafId = requestAnimationFrame(tick);
  };

  /**
   * Compensa la rotación de la pantalla: los ejes beta/gamma del sensor
   * son relativos al chasis del teléfono, no a la pantalla visible.
   */
  const ejesPantalla = (beta, gamma) => {
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    switch (angle) {
      case 90:
        return { x: beta, y: -gamma };
      case 270:
      case -90:
        return { x: -beta, y: gamma };
      case 180:
        return { x: -gamma, y: -beta };
      default:
        return { x: gamma, y: beta };
    }
  };

  /** @param {DeviceOrientationEvent} e */
  const handleOrientation = (e) => {
    if (e.beta == null || e.gamma == null) return;

    const { x, y } = ejesPantalla(e.beta, e.gamma);

    // la primera lectura define el "centro" (posición cómoda del usuario)
    if (!base) base = { x, y };

    const rel = { x: x - base.x, y: y - base.y };

    if (!usandoPuntero) {
      target.x = adjust(clamp(rel.x, -LIMIT_X, LIMIT_X), -LIMIT_X, LIMIT_X, 0, 100);
      target.y = adjust(clamp(rel.y, -LIMIT_Y, LIMIT_Y), -LIMIT_Y, LIMIT_Y, 0, 100);
    }

    if (!sensorActivo) {
      sensorActivo = true;
      onStatus?.("ok", "Sensores activos — incliná el celular");
    }
  };

  /** Fallback: arrastrar con el dedo o mover el mouse sobre la carta. */
  const handlePointer = (e) => {
    const rect = card.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    usandoPuntero = true;
    target.x = clamp(((e.clientX - rect.left) / rect.width) * 100);
    target.y = clamp(((e.clientY - rect.top) / rect.height) * 100);
  };

  const handlePointerEnd = () => {
    usandoPuntero = false;
  };

  const attachSensor = () => {
    window.addEventListener("deviceorientation", handleOrientation, true);
    // algunos dispositivos solo emiten el evento absoluto
    setTimeout(() => {
      if (!sensorActivo) {
        window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      }
    }, 1500);
    // si no llegan datos, avisar que el fallback es arrastrar
    setTimeout(() => {
      if (!sensorActivo) {
        onStatus?.("error", "Sin datos de sensores — arrastrá sobre la carta");
      }
    }, 2500);
  };

  /** Inicia el controlador (pide permiso en iOS si hace falta). */
  const start = async () => {
    if (iniciado) return;
    iniciado = true;

    if (necesitaPermiso) {
      onStatus?.("info", "Tocá la pantalla para activar los sensores");
      document.addEventListener(
        "pointerdown",
        async () => {
          try {
            const resultado = await DeviceOrientationEvent.requestPermission();
            if (resultado === "granted") {
              attachSensor();
            } else {
              onStatus?.("error", "Permiso de sensores denegado — arrastrá sobre la carta");
            }
          } catch {
            onStatus?.("error", "No se pudieron activar los sensores");
          }
        },
        { once: true }
      );
    } else {
      attachSensor();
    }

    card.addEventListener("pointermove", handlePointer);
    card.addEventListener("pointerdown", handlePointer);
    card.addEventListener("pointerup", handlePointerEnd);
    card.addEventListener("pointerleave", handlePointerEnd);

    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  };

  /** Toma la posición actual del teléfono como nuevo centro del efecto. */
  const recenter = () => {
    base = null;
  };

  const stop = () => {
    window.removeEventListener("deviceorientation", handleOrientation, true);
    window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
    card.removeEventListener("pointermove", handlePointer);
    card.removeEventListener("pointerdown", handlePointer);
    card.removeEventListener("pointerup", handlePointerEnd);
    card.removeEventListener("pointerleave", handlePointerEnd);
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    iniciado = false;
  };

  return { start, stop, recenter };
}

import "./styles/app.css";
import "./styles/card.css";
import "./styles/effects.css";
import { createHoloController } from "./lib/orientation.js";

const card = document.getElementById("carta");
const estado = document.getElementById("estado-sensores");
const btnRecentrar = document.getElementById("btn-recentrar");
const botonesEfecto = document.querySelectorAll(".efecto");

const setEstado = (tipo, mensaje) => {
  estado.textContent = mensaje;
  estado.classList.toggle("ok", tipo === "ok");
  estado.classList.toggle("error", tipo === "error");
};

const controller = createHoloController(card, { onStatus: setEstado });
controller.start();

// Selector de efecto holo
botonesEfecto.forEach((btn) => {
  btn.addEventListener("click", () => {
    botonesEfecto.forEach((b) => b.classList.remove("activo"));
    btn.classList.add("activo");
    card.dataset.rarity = btn.dataset.effect;
  });
});

// Recentrar: la posición actual del teléfono pasa a ser el centro
btnRecentrar.addEventListener("click", () => {
  controller.recenter();
  setEstado("ok", "Centro recalibrado");
});

// Service worker (solo en contexto seguro: https o localhost)
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // el SW es opcional para la PoC; ignorar errores de registro
    });
  });
}

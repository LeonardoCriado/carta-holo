# Carta Holo 🃏✨

PoC de app móvil (PWA) que emula el efecto holográfico de las cartas de Pokémon / Yu-Gi-Oh. La carta permanece **fija** en pantalla; al inclinar el celular, los brillos, arcoíris y reflejos se desplazan como al mirar una carta holo real desde distintos ángulos.

## Cómo funciona

- Los efectos holo (capas `card__shine` y `card__glare`) son CSS puro, portados de [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css).
- El control por sensores sigue el enfoque de [DongGukMon/TiltHologramCard](https://github.com/DongGukMon/TiltHologramCard), pero con la `DeviceOrientationEvent` del navegador en lugar del giroscopio nativo.
- El motor ([src/lib/orientation.js](src/lib/orientation.js)) mapea la inclinación del teléfono (±16°/±18°) a las variables CSS `--pointer-x/y` y `--background-x/y`, con:
  - **Calibración**: la primera lectura (o el botón «Recentrar») define el centro del efecto.
  - **Compensación de rotación de pantalla** (portrait/landscape).
  - **Suavizado exponencial** independiente del framerate.
  - **Fallback** a arrastre táctil/mouse si no hay sensores.
  - **Permiso iOS** (`DeviceOrientationEvent.requestPermission`) cuando corresponde.

## Efectos incluidos

| Botón | `data-rarity` | Origen |
|---|---|---|
| Holo | `rare holo` | `regular-holo.css` |
| Cosmos | `rare holo cosmos` | `cosmos-holo.css` |
| Shiny V | `rare shiny v` | `shiny-v.css` |
| Arcoíris | `rare rainbow` | `rainbow-holo.css` |
| VMAX | `rare holo vmax` | `v-max.css` |

## Desarrollo

```bash
npm install
npm run dev        # servidor en la red local (http://TU_IP:5173)
npm run dev:https  # con certificado autofirmado (iOS y Android exigen HTTPS para sensores)
npm run build      # build de producción
```

Para probar en el celular: Chrome (Android/iOS) solo emite datos del giroscopio en contextos seguros, así que usá `npm run dev:https` y abrí `https://IP_DE_TU_PC:5173` aceptando el certificado autofirmado. Por HTTP plano (`http://IP_DE_TU_PC:5173`) la app funciona con el fallback de arrastre sobre la carta.

## Estructura

```
index.html                  # shell de la app (UI en español)
src/main.js                 # wiring: controlador, selector de efectos, SW
src/lib/orientation.js      # giroscopio → variables CSS
src/lib/math.js             # helpers clamp/round/adjust
src/styles/card.css         # estructura de la carta + capas shine/glare
src/styles/effects.css      # 5 efectos holo portados
src/styles/app.css          # layout móvil
public/assets/              # carta de ejemplo + texturas holo
public/sw.js                # service worker (cache-first)
public/manifest.webmanifest # manifest PWA
```

## Notas

- La carta de ejemplo (Charizard VMAX) y las texturas provienen del repo de referencia y del CDN de Pokémon TCG; para un uso público conviene reemplazarlas por arte propio.
- El service worker solo se registra en contexto seguro (HTTPS o localhost); cachea en runtime lo visitado, así que la app funciona offline tras la primera carga.

/**
 * Utilidades matemáticas (portadas de pokemon-cards-css).
 */

/** Redondea a una precisión dada (por defecto 3 decimales). */
export const round = (value, precision = 3) =>
  parseFloat(value.toFixed(precision));

/** Limita un valor entre min y max. */
export const clamp = (value, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

/** Re-mapea un valor de un rango a otro. */
export const adjust = (value, fromMin, fromMax, toMin, toMax) =>
  round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin));

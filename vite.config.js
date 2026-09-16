import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// HTTPS=1 habilita un certificado autofirmado (necesario si el navegador
// del celular exige contexto seguro para los sensores, p. ej. iOS Safari).
export default defineConfig({
  plugins: process.env.HTTPS ? [basicSsl()] : [],
  server: {
    host: true, // expone en la red local para probar desde el celular
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});

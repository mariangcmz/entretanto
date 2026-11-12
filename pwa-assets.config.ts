import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Íconos de la PWA desde public/icono.svg: `npx pwa-assets-generator`. El SVG ya trae su fondo
// y deja el calado dentro de la zona segura, así que ningún tamaño lleva margen extra.
const sinMargen = { padding: 0, resizeOptions: { background: '#3B1439' } }
export default defineConfig({
  preset: { ...minimal2023Preset, transparent: { ...minimal2023Preset.transparent, ...sinMargen }, maskable: { ...minimal2023Preset.maskable, ...sinMargen }, apple: { ...minimal2023Preset.apple, ...sinMargen } },
  images: ['public/icono.svg'],
})

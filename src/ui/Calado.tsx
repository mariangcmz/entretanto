// Ornamento inspirado en el calado del barro negro de Oaxaca: anillos de pétalos, puntos y ventanas.
// Decorativo: va recortado en la esquina de un banner y el lector de pantalla lo ignora.
const vueltas = (n: number) => Array.from({ length: n }, (_, i) => (i * 360) / n)

export const Calado = (p: { class?: string }) => (
  <svg class={p.class} viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    {vueltas(36).map(g => <circle key={g} cx="0" cy="-94" r="2.2" fill="currentColor" stroke="none" transform={`rotate(${g})`} />)}
    <circle r="88" />
    {vueltas(18).map(g => <path key={g} d="M0,-52 C10,-60 10,-74 0,-84 C-10,-74 -10,-60 0,-52 Z" transform={`rotate(${g})`} />)}
    {vueltas(18).map(g => <path key={g} d="M0,-58 C4,-63 4,-70 0,-75 C-4,-70 -4,-63 0,-58 Z" fill="currentColor" stroke="none" transform={`rotate(${g})`} />)}
    <circle r="48" />
    {vueltas(12).map(g => <ellipse key={g} cx="0" cy="-36" rx="4.5" ry="8" transform={`rotate(${g})`} />)}
    <circle r="24" />
    {vueltas(8).map(g => <circle key={g} cx="0" cy="-15" r="3" fill="currentColor" stroke="none" transform={`rotate(${g})`} />)}
    <circle r="6" fill="currentColor" stroke="none" />
  </svg>
)

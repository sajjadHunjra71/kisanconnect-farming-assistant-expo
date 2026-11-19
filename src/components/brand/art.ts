/**
 * KisanConnect brand art as plain SVG strings (one source for the app, the icon renders and previews).
 * Flat, friendly farm objects in the app palette. All drawn on a 100×100 canvas.
 */

export const BRAND = {
  green: '#1F5C3F',
  greenDeep: '#14402B',
  leaf: '#7CC45A',
  leafDark: '#4E9A3A',
  gold: '#E9B949',
  goldDeep: '#C98F22',
  cream: '#F6F2E9',
  splash: '#F3C44A',
  sky: '#4F9BD9',
  soil: '#8A5A3B',
  red: '#D9533B',
} as const;

const B = BRAND;

/** App mark: a sprout whose stem and two leaves form a "K", on a green squircle. */
export const LOGO_MARK = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="96" height="96" rx="30" fill="${B.green}"/>
  <path d="M34 80 V22" stroke="${B.cream}" stroke-width="11" stroke-linecap="round"/>
  <path d="M38 54 C41 32 57 18 82 16 C81 40 64 53 38 54 Z" fill="${B.leaf}"/>
  <path d="M40 53 C56 44 70 34 80 18" stroke="${B.leafDark}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
  <path d="M40 58 C60 57 78 66 83 84 C63 86 46 77 40 58 Z" fill="${B.gold}"/>
  <path d="M42 59 C56 64 70 72 81 82" stroke="${B.goldDeep}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
</svg>`;

/** Logo option B: a wheat ear on a gold squircle. */
export const LOGO_WHEAT = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="96" height="96" rx="30" fill="${B.gold}"/>
  <path d="M50 86 V24" stroke="${B.green}" stroke-width="5" stroke-linecap="round"/>
  ${[0, 1, 2, 3]
    .map((i) => {
      const y = 34 + i * 12;
      return `<ellipse cx="39" cy="${y}" rx="5.5" ry="10" transform="rotate(-35 39 ${y})" fill="${B.green}"/>
  <ellipse cx="61" cy="${y}" rx="5.5" ry="10" transform="rotate(35 61 ${y})" fill="${B.green}"/>`;
    })
    .join('\n  ')}
  <ellipse cx="50" cy="20" rx="6" ry="10" fill="${B.green}"/>
</svg>`;

/** Logo option C: a leaf with "connect" signal arcs on a cream squircle. */
export const LOGO_LEAF = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="96" height="96" rx="30" fill="${B.cream}"/>
  <path d="M24 76 C24 44 44 26 76 24 C76 56 56 76 24 76 Z" fill="${B.green}"/>
  <path d="M26 74 C42 58 54 46 70 30" stroke="${B.leaf}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M66 62 a10 10 0 0 1 10 10" stroke="${B.gold}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M66 50 a22 22 0 0 1 22 22" stroke="${B.gold}" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

export const OBJECTS = {
  sun: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${Array.from({ length: 10 }, (_, i) => `<rect x="47" y="4" width="6" height="16" rx="3" fill="${B.goldDeep}" transform="rotate(${i * 36} 50 50)"/>`).join('')}
  <circle cx="50" cy="50" r="26" fill="#FFD45C"/>
  <circle cx="44" cy="44" r="10" fill="#FFE79A"/>
</svg>`,
  cloudRain: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M26 62 a16 16 0 0 1 4-31 a22 22 0 0 1 41 6 a13 13 0 0 1 2 25 Z" fill="#FFFFFF"/>
  <path d="M26 62 h47 a13 13 0 0 0 9-6 a14 14 0 0 1-12 3 H30 a16 16 0 0 1-12-6 a16 16 0 0 0 8 9Z" fill="#D7E6F2"/>
  ${[32, 50, 68].map((x, i) => `<path d="M${x} ${70 + (i % 2) * 6} q4 7 0 11 q-4-4 0-11Z" fill="${B.sky}"/>`).join('')}
</svg>`,
  drop: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 10 C64 32 78 46 78 64 a28 28 0 0 1-56 0 C22 46 36 32 50 10Z" fill="${B.sky}"/>
  <path d="M38 62 a13 13 0 0 0 10 14" stroke="#BFE0FA" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`,
  wheat: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 96 V30" stroke="#8C5A12" stroke-width="4" stroke-linecap="round"/>
  ${[0, 1, 2, 3]
    .map((i) => {
      const y = 30 + i * 12;
      return `<ellipse cx="42" cy="${y}" rx="6" ry="11" transform="rotate(-30 42 ${y})" fill="#B8761C"/><ellipse cx="58" cy="${y}" rx="6" ry="11" transform="rotate(30 58 ${y})" fill="#B8761C"/><ellipse cx="41" cy="${y - 3}" rx="2" ry="5" transform="rotate(-30 41 ${y - 3})" fill="#E2A64A"/><ellipse cx="59" cy="${y - 3}" rx="2" ry="5" transform="rotate(30 59 ${y - 3})" fill="#E2A64A"/>`;
    })
    .join('')}
  <ellipse cx="50" cy="20" rx="5.5" ry="10" fill="#B8761C"/>
  <path d="M50 10 L50 2 M44 14 L39 5 M56 14 L61 5" stroke="#8C5A12" stroke-width="1.6" stroke-linecap="round"/>
</svg>`,
  cotton: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 62 L22 86 L38 62 Z M50 62 L78 86 L62 62Z M50 64 L50 94" stroke="${B.soil}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" fill="${B.soil}"/>
  <circle cx="34" cy="46" r="17" fill="#FFFFFF"/><circle cx="66" cy="46" r="17" fill="#FFFFFF"/>
  <circle cx="50" cy="30" r="18" fill="#FFFFFF"/><circle cx="50" cy="54" r="16" fill="#F1ECE2"/>
</svg>`,
  leaf: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 86 C14 46 40 16 88 12 C86 60 58 86 14 86Z" fill="${B.leaf}"/>
  <path d="M16 84 C38 62 58 42 80 20" stroke="${B.leafDark}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M40 60 L36 40 M54 46 L52 28 M44 58 L64 60 M58 44 L74 46" stroke="${B.leafDark}" stroke-width="2.5" stroke-linecap="round"/>
</svg>`,
  tractor: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="44" y="26" width="26" height="30" rx="4" fill="${B.red}"/>
  <rect x="49" y="31" width="16" height="13" rx="2" fill="#CFE8F7"/>
  <path d="M14 58 h60 v-8 h-30 l-6-10 h-16 Z" fill="${B.red}"/>
  <rect x="20" y="36" width="5" height="16" rx="2" fill="#333"/>
  <circle cx="64" cy="66" r="20" fill="#2B2B2B"/><circle cx="64" cy="66" r="9" fill="${B.gold}"/>
  <circle cx="24" cy="74" r="12" fill="#2B2B2B"/><circle cx="24" cy="74" r="5" fill="${B.gold}"/>
</svg>`,
  chili: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 26 C24 60 46 88 86 90 C62 78 52 54 48 28 Z" fill="${B.red}"/>
  <path d="M36 36 C38 56 48 72 64 80" stroke="#F08A70" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M28 28 C30 20 40 18 50 26 L48 32 C40 28 34 30 30 32Z" fill="${B.leafDark}"/>
  <path d="M38 22 C38 14 34 8 28 6" stroke="${B.leafDark}" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`,
  corn: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="50" cy="44" rx="17" ry="34" fill="#FFD45C"/>
  ${[0, 1, 2, 3, 4, 5]
    .map((r) => [-1, 0, 1].map((c) => `<circle cx="${50 + c * 9}" cy="${20 + r * 9}" r="3.4" fill="${B.goldDeep}" opacity="0.45"/>`).join(''))
    .join('')}
  <path d="M50 94 C30 86 24 64 30 44 C36 62 42 74 50 80Z" fill="${B.leaf}"/>
  <path d="M50 94 C70 86 76 64 70 44 C64 62 58 74 50 80Z" fill="${B.leafDark}"/>
</svg>`,
  can: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M66 44 L92 26 L95 31 L72 54 Z" fill="${B.sky}"/>
  <rect x="20" y="36" width="50" height="46" rx="8" fill="${B.sky}"/>
  <path d="M30 36 C30 18 60 18 60 36" stroke="#2F6F9F" stroke-width="7" fill="none" stroke-linecap="round"/>
  <rect x="20" y="50" width="50" height="8" fill="#2F6F9F" opacity="0.35"/>
  ${[0, 1, 2].map((i) => `<circle cx="${94 + i * 2}" cy="${38 + i * 8}" r="2.5" fill="${B.sky}"/>`).join('')}
</svg>`,
  sprout: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 66 h56 l-7 28 h-42 Z" fill="${B.soil}"/>
  <rect x="18" y="60" width="64" height="10" rx="4" fill="#A26C47"/>
  <path d="M50 60 V36" stroke="${B.leafDark}" stroke-width="5" stroke-linecap="round"/>
  <path d="M50 40 C46 22 30 16 16 18 C18 34 32 42 50 40Z" fill="${B.leaf}"/>
  <path d="M50 34 C54 18 70 10 86 12 C84 28 68 36 50 34Z" fill="${B.leaf}"/>
</svg>`,
  coin: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="52" r="38" fill="${B.goldDeep}"/>
  <circle cx="50" cy="48" r="38" fill="#FFD45C"/>
  <circle cx="50" cy="48" r="29" fill="none" stroke="${B.goldDeep}" stroke-width="3"/>
  <text x="50" y="60" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30" fill="${B.goldDeep}">Rs</text>
</svg>`,
  sparkle: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 6 C54 40 60 46 94 50 C60 54 54 60 50 94 C46 60 40 54 6 50 C40 46 46 40 50 6Z" fill="#FFFFFF"/>
</svg>`,
  dot: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="${B.green}" opacity="0.85"/></svg>`,
} as const;

export type FarmObject = keyof typeof OBJECTS;

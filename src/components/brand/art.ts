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

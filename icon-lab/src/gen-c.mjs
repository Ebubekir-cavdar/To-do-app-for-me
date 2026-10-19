// Concept C — "Mühürlü Defter": the leather journal as an object on an EU4 slate panel,
// brass corner protectors, crimson ribbon and a wax seal stamped with a gilded crescent & star.
import fs from 'node:fs';
import { defs, svgDoc, brassFilter, n, rot, star8, mandala } from './common.mjs';

const base = defs({ seed: 17, grainFreq: 0.5, grainScale: 2.0, mottle: 0.55 });
// book geometry (cover)
const X1 = 360, X2 = 716, Y1 = 312, Y2 = 768;           // cover rect
const PX = 18, PY = 14;                                  // page block / back cover offset
const SC = [538, 540];                                   // seal centre
const RIB = [514, 566];                                  // ribbon y band

// irregular wax-seal outline
function waxPath(r0) {
  let d = '';
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const t = i / N * Math.PI * 2;
    const r = r0 + 4.5 * Math.sin(5 * t + 1.1) + 2.6 * Math.sin(11 * t + 0.4) + 1.6 * Math.sin(23 * t) + (t > 3.6 && t < 4.3 ? 9 * Math.sin((t - 3.6) / 0.7 * Math.PI) : 0)
      + (t > 0.5 && t < 1.0 ? 6 * Math.sin((t - 0.5) / 0.5 * Math.PI) : 0);
    d += (i ? 'L' : 'M') + n(SC[0] + r * Math.cos(t)) + ',' + n(SC[1] + r * Math.sin(t));
  }
  return d + 'Z';
}
function star5(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = (i * 36 - 90) * Math.PI / 180, rr = i % 2 ? r * 0.4 : r; d += (i ? 'L' : 'M') + n(cx + rr * Math.cos(a)) + ',' + n(cy + rr * Math.sin(a)); }
  return d + 'Z';
}
// crescent opening to the right (outer r=44 at 0,0; inner r=36 at 13,0), star in the opening
const crescent = (s = 1) => `M${n(31.1 * s)},${n(-31.1 * s)}A${44 * s},${44 * s} 0 1 0 ${n(31.1 * s)},${n(31.1 * s)}A${36 * s},${36 * s} 0 1 1 ${n(31.1 * s)},${n(-31.1 * s)}Z`;
// brass corner protector (top-left orientation), then rotated
const cornerPath = 'M-4,-4L84,-4Q38,4 30,30Q4,38 -4,84Z';
// absolute-coordinate corner path (no rotation, so the filter lighting stays top-left for every corner)
const cornerAbs = (cx, cy, sx, sy) => {
  const P = (x, y) => `${n(cx + sx * x)},${n(cy + sy * y)}`;
  return `M${P(-4, -4)}L${P(88, -4)}C${P(60, 2)} ${P(46, 14)} ${P(40, 40)}C${P(14, 46)} ${P(2, 60)} ${P(-4, 88)}Z`;
};
const cornersAbs = (fn) => [[X1, Y1, 1, 1], [X2, Y1, -1, 1], [X2, Y2, -1, -1], [X1, Y2, 1, -1]].map(([x, y, sx, sy]) => fn(x, y, sx, sy)).join('');
const corners = (fn) => [[X1, Y1, 0], [X2, Y1, 90], [X2, Y2, 180], [X1, Y2, 270]].map(([x, y, a]) => fn(x, y, a)).join('');

const extra = `
  ${brassFilter('brassC', { blur: 2.4, ss: 3.5, pf: 0.08, pat: 0.25, sx: 3, sy: 5, sb: 3.5, so: 0.6 })}
  <radialGradient id="slate" gradientUnits="userSpaceOnUse" cx="470" cy="420" r="700">
    <stop offset="0" stop-color="#55606d"/><stop offset="0.4" stop-color="#363e48"/>
    <stop offset="0.75" stop-color="#20252c"/><stop offset="1" stop-color="#101317"/>
  </radialGradient>
  <filter id="brushed" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency="0.004 0.35" numOctaves="2" seed="3" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 -0.4" result="w"/>
    <feComposite in="w" in2="SourceGraphic" operator="in"/>
  </filter>
  <radialGradient id="glowC" gradientUnits="userSpaceOnUse" cx="540" cy="540" r="380">
    <stop offset="0" stop-color="#d4ad57" stop-opacity="0.28"/><stop offset="0.6" stop-color="#d4ad57" stop-opacity="0.08"/>
    <stop offset="1" stop-color="#d4ad57" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="goldRing" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6e3a1"/><stop offset="0.35" stop-color="#d4ad57"/><stop offset="0.7" stop-color="#8a6526"/><stop offset="1" stop-color="#6b4f1e"/>
  </linearGradient>
  <linearGradient id="goldLeaf" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6e3a1"/><stop offset="0.45" stop-color="#d4ad57"/><stop offset="1" stop-color="#8f6a28"/>
  </linearGradient>
  <radialGradient id="coverC" gradientUnits="userSpaceOnUse" cx="480" cy="440" r="420">
    <stop offset="0" stop-color="#b07443"/><stop offset="0.5" stop-color="#8c522a"/><stop offset="1" stop-color="#4f2810"/>
  </radialGradient>
  <linearGradient id="spineC" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2a1205" stop-opacity="0.85"/><stop offset="0.6" stop-color="#3a1a08" stop-opacity="0.35"/><stop offset="1" stop-color="#3a1a08" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="burnC" gradientUnits="userSpaceOnUse" cx="538" cy="540" r="330">
    <stop offset="0" stop-color="#1e0a02" stop-opacity="0"/><stop offset="0.62" stop-color="#1e0a02" stop-opacity="0.05"/>
    <stop offset="1" stop-color="#1e0a02" stop-opacity="0.6"/>
  </radialGradient>
  <linearGradient id="pagesC" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#cdb27a"/><stop offset="0.5" stop-color="#efdcae"/><stop offset="1" stop-color="#a88a55"/>
  </linearGradient>
  <linearGradient id="ribbonC" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c03a2c"/><stop offset="0.3" stop-color="#9a1f18"/><stop offset="0.75" stop-color="#6e0f0b"/><stop offset="1" stop-color="#3e0604"/>
  </linearGradient>
  <radialGradient id="waxC" cx="0.5" cy="0.5" r="0.5" fx="0.4" fy="0.36">
    <stop offset="0" stop-color="#c8392b"/><stop offset="0.55" stop-color="#9c1c16"/><stop offset="0.9" stop-color="#650d09"/><stop offset="1" stop-color="#4a0805"/>
  </radialGradient>
  <radialGradient id="waxIn" cx="0.5" cy="0.5" r="0.5" fx="0.6" fy="0.66">
    <stop offset="0" stop-color="#a5241b"/><stop offset="0.75" stop-color="#7d1410"/><stop offset="1" stop-color="#4f0805"/>
  </radialGradient>
  <filter id="wax" color-interpolation-filters="sRGB" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b"/>
    <feSpecularLighting in="b" surfaceScale="6" specularConstant="1.1" specularExponent="28" lighting-color="#ffd6c8" result="s">
      <feDistantLight azimuth="225" elevation="38"/>
    </feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
    <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k2="1" k3="0.55" result="w"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="sb"/><feOffset in="sb" dx="4" dy="7" result="so"/>
    <feFlood flood-color="#120200" flood-opacity="0.65"/><feComposite in2="so" operator="in" result="sh"/>
    <feMerge><feMergeNode in="sh"/><feMergeNode in="w"/></feMerge>
  </filter>
  <filter id="sunk" color-interpolation-filters="sRGB" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="b"/>
    <feOffset in="b" dx="3" dy="4" result="o"/>
    <feComposite in="SourceAlpha" in2="o" operator="out" result="edge"/>
    <feFlood flood-color="#1c0201" flood-opacity="0.85"/><feComposite in2="edge" operator="in" result="is"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="is"/></feMerge>
  </filter>
  <filter id="bookShadow" x="-20%" y="-20%" width="150%" height="150%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="16"/><feOffset dx="12" dy="20" result="o"/>
    <feFlood flood-color="#000" flood-opacity="0.62"/><feComposite in2="o" operator="in"/>
  </filter>
  <clipPath id="coverClipC"><rect x="${X1}" y="${Y1}" width="${X2 - X1}" height="${Y2 - Y1}" rx="10"/></clipPath>
  <mask id="monoC" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1080">
    <rect width="1080" height="1080" fill="#fff"/>
    <g fill="#000">
      <circle cx="${SC[0]}" cy="${SC[1]}" r="104"/>
      <rect x="${X1 + 22}" y="${RIB[0] - 6}" width="${X2 - X1 - 22}" height="7"/>
      <rect x="${X1 + 22}" y="${RIB[1] - 1}" width="${X2 - X1 - 22}" height="7"/>
      <rect x="${X2}" y="${Y1}" width="9" height="${Y2 - Y1 + PY}"/>
      <rect x="${X1 + 30}" y="${Y1 + 30}" width="7" height="${Y2 - Y1 - 60}"/>
      ${corners((x, y, a) => `<path d="M96,-4Q46,10 38,38Q10,46 -4,96L-4,84Q4,38 30,30Q38,4 84,-4Z" transform="translate(${x},${y}) rotate(${a})"/>`)}
    </g>
  </mask>`;

// gilt frame + fleurons on the cover
function giltFrame() {
  const i1 = 28, i2 = 40;
  let s = `<rect x="${X1 + i1}" y="${Y1 + i1}" width="${X2 - X1 - 2 * i1}" height="${Y2 - Y1 - 2 * i1}" rx="6" fill="none" stroke="#000" stroke-width="5"/>
           <rect x="${X1 + i2}" y="${Y1 + i2}" width="${X2 - X1 - 2 * i2}" height="${Y2 - Y1 - 2 * i2}" rx="3" fill="none" stroke="#000" stroke-width="2.5"/>`;
  // small diamonds on the frame mid-points + fleurons at top/bottom centre
  for (const [x, y] of [[SC[0], Y1 + i1], [SC[0], Y2 - i1], [X1 + i1, SC[1]], [X2 - i1, SC[1]]]) s += `<path d="M${x - 11},${y}L${x},${y - 11}L${x + 11},${y}L${x},${y + 11}Z"/>`;
  return s;
}

const bg = `
  <rect width="1080" height="1080" fill="url(#slate)"/>
  <rect width="1080" height="1080" fill="#fff" opacity="0.05" filter="url(#brushed)"/>
  <rect width="1080" height="1080" fill="url(#glowC)"/>
  <circle cx="540" cy="540" r="346" fill="none" stroke="#0a0b0d" stroke-opacity="0.55" stroke-width="10" transform="translate(2,4)"/>
  <circle cx="540" cy="540" r="346" fill="none" stroke="url(#goldRing)" stroke-width="6"/>
  <circle cx="540" cy="540" r="334" fill="none" stroke="#d4ad57" stroke-opacity="0.45" stroke-width="2"/>
  ${[0, 90, 180, 270].map(a => `<path d="M540,180l12,14l-12,14l-12,-14Z" fill="url(#goldRing)" transform="rotate(${a + 45} 540 540)"/>`).join('')}`;

const fg = `
  <g transform="translate(540,540) scale(1.05) translate(-540,-540)">
    <rect x="${X1 + 4}" y="${Y1 + 6}" width="${X2 - X1 + PX}" height="${Y2 - Y1 + PY}" rx="12" filter="url(#bookShadow)"/>
    <!-- back cover + page block -->
    <rect x="${X1 + 6}" y="${Y1 + 6}" width="${X2 - X1 + PX}" height="${Y2 - Y1 + PY}" rx="12" fill="#3a1d0a"/>
    <rect x="${X2 - 6}" y="${Y1 + 10}" width="${PX + 2}" height="${Y2 - Y1 - 4}" rx="3" fill="url(#pagesC)"/>
    <g stroke="#8a6c3c" stroke-opacity="0.55" stroke-width="1.2">${Array.from({ length: 6 }, (_, i) => `<line x1="${X2 - 2 + i * 3}" y1="${Y1 + 14}" x2="${X2 - 2 + i * 3}" y2="${Y2 + 2}"/>`).join('')}</g>
    <!-- cover -->
    <rect x="${X1}" y="${Y1}" width="${X2 - X1}" height="${Y2 - Y1}" rx="10" fill="url(#coverC)" filter="url(#grain)"/>
    <g clip-path="url(#coverClipC)">
      <rect x="${X1}" y="${Y1}" width="40" height="${Y2 - Y1}" fill="url(#spineC)"/>
      <g filter="url(#deboss)"><rect x="${X1 + 30}" y="${Y1}" width="5" height="${Y2 - Y1}"/></g><g filter="url(#deboss)" opacity="0.72"><g transform="translate(${SC[0]},${SC[1]}) scale(0.46)">${mandala()}</g></g>
      <g fill="url(#goldLeaf)" filter="url(#gilt)">${giltFrame().replace(/stroke="#000"/g, 'stroke="#d4ad57"').replace(/fill="#000"/g, 'fill="#8a5a2a"')}</g>
      <rect x="${X1}" y="${Y1}" width="${X2 - X1}" height="${Y2 - Y1}" fill="url(#burnC)"/>
      <!-- ribbon band -->
      <rect x="${X1}" y="${RIB[0] + 6}" width="${X2 - X1}" height="${RIB[1] - RIB[0]}" fill="#000" opacity="0.35" filter="url(#dshadow)"/>
      <rect x="${X1}" y="${RIB[0]}" width="${X2 - X1}" height="${RIB[1] - RIB[0]}" fill="url(#ribbonC)"/>
      <g stroke="#e4c06c" stroke-opacity="0.85" stroke-width="2.4" stroke-dasharray="9 7">
        <line x1="${X1}" y1="${RIB[0] + 6}" x2="${X2}" y2="${RIB[0] + 6}"/><line x1="${X1}" y1="${RIB[1] - 6}" x2="${X2}" y2="${RIB[1] - 6}"/>
      </g>
    </g>
    <!-- ribbon wrapping over the page block -->
    <rect x="${X2 - 4}" y="${RIB[0] + 3}" width="${PX + 4}" height="${RIB[1] - RIB[0]}" rx="3" fill="url(#ribbonC)"/><rect x="${X2 - 4}" y="${RIB[0] + 3}" width="${PX + 4}" height="${RIB[1] - RIB[0]}" rx="3" fill="#200200" opacity="0.45"/>
    <rect x="${X1}" y="${Y1}" width="${X2 - X1}" height="${Y2 - Y1}" rx="10" fill="none" stroke="#1d0b02" stroke-opacity="0.6" stroke-width="3"/>
    <!-- brass corners -->
    ${cornersAbs((x, y, sx, sy) => `<path d="${cornerAbs(x, y, sx, sy)}" fill="url(#brassG)" filter="url(#brassC)"/><circle cx="${x + sx * 18}" cy="${y + sy * 18}" r="7.5" fill="url(#rivetG)" filter="url(#dshadow)"/>`)}
    <!-- wax seal -->
    <path d="${waxPath(96)}" fill="url(#waxC)" filter="url(#wax)"/>
    <circle cx="${SC[0]}" cy="${SC[1]}" r="70" fill="url(#waxIn)" filter="url(#sunk)"/>
    <g fill="#e9b9a4" opacity="0.5">${rot(28, a => `<circle cx="${SC[0]}" cy="${SC[1] - 80}" r="3.2" transform="rotate(${a} ${SC[0]} ${SC[1]})"/>`)}</g>
    <g transform="translate(${SC[0] - 8},${SC[1]})" filter="url(#brassC)">
      <path d="${crescent(1.15)}" fill="url(#goldLeaf)"/>
      <path d="${star5(40, 0, 19)}" fill="url(#goldLeaf)" transform="rotate(-18 40 0)"/>
    </g>
  </g>`;

const mono = `<g transform="translate(540,540) scale(1.05) translate(-540,-540)">
  <g mask="url(#monoC)">
    <rect x="${X1}" y="${Y1}" width="${X2 - X1 + PX}" height="${Y2 - Y1 + PY}" rx="12"/>
  </g>
  <g transform="translate(${SC[0] - 8},${SC[1]})">
    <path d="${crescent(1.25)}"/>
    <path d="${star5(44, 0, 21)}" transform="rotate(-18 44 0)"/>
  </g>
  <circle cx="${SC[0]}" cy="${SC[1]}" r="92" fill="none" stroke="#fff" stroke-width="8"/></g>`;

fs.writeFileSync('C:/Users/PC/desktop/TO_DO_APP/icon-lab/c.svg', svgDoc(base, bg, fg, mono, extra));
console.log('c.svg written');

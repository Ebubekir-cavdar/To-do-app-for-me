// Concept B — "Pirinç Kilit": macro close-up of the brass hasp & rivets over embossed, stitched leather.
import fs from 'node:fs';
import { defs, mandala, rosette, clasp, svgDoc, hingePlate, paddle, rivetPts, brassFilter } from './common.mjs';

const CS = 2.4;                 // clasp scale
const TX = 517;                 // clasp origin = flap seam x
const base = defs({ seed: 5, grainFreq: 0.38, grainScale: 2.6 });
const grain2 = base.match(/<filter id="grain"[\s\S]*?<\/filter>/)[0].replace('id="grain"', 'id="grain2"').replace(/seed="(\d+)"/g, (m, s) => `seed="${+s + 40}"`);

const extra = `
  ${grain2}
  ${brassFilter('brassB', { blur: 1.5, ss: 3.2, pf: 0.11, pat: 0.12, sx: 2.5, sy: 3.6, sb: 2.6, so: 0.7, spec: 0.85 })}
  <radialGradient id="leatherB" gradientUnits="userSpaceOnUse" cx="430" cy="430" r="640">
    <stop offset="0" stop-color="#a45a2e"/><stop offset="0.35" stop-color="#874521"/>
    <stop offset="0.65" stop-color="#5e2c13"/><stop offset="1" stop-color="#2c1006"/>
  </radialGradient>
  <linearGradient id="flapB" x1="0" y1="0" x2="1" y2="0.3">
    <stop offset="0" stop-color="#8f4a24"/><stop offset="1" stop-color="#4e230d"/>
  </linearGradient>
  <radialGradient id="vigB" gradientUnits="userSpaceOnUse" cx="540" cy="540" r="560">
    <stop offset="0" stop-color="#160601" stop-opacity="0"/><stop offset="0.42" stop-color="#160601" stop-opacity="0"/>
    <stop offset="0.66" stop-color="#160601" stop-opacity="0.5"/><stop offset="1" stop-color="#0d0300" stop-opacity="0.9"/>
  </radialGradient>
  <radialGradient id="glowB" gradientUnits="userSpaceOnUse" cx="470" cy="520" r="300">
    <stop offset="0" stop-color="#ffcf8a" stop-opacity="0.22"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="edgeB" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#1c0802" stop-opacity="0.9"/><stop offset="1" stop-color="#1c0802" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="coverClipB"><rect x="0" y="0" width="${TX}" height="1080"/></clipPath>
  <clipPath id="flapClipB"><rect x="${TX}" y="0" width="${1080 - TX}" height="1080"/></clipPath>
  <filter id="flapShadowB" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dx="-4" dy="6" result="o"/>
    <feFlood flood-color="#0d0300" flood-opacity="0.6"/><feComposite in2="o" operator="in" result="s"/>
    <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="thread" x="-20%" y="-5%" width="140%" height="110%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b"/><feOffset dx="2" dy="3" result="o"/>
    <feFlood flood-color="#120400" flood-opacity="0.7"/><feComposite in2="o" operator="in" result="s"/>
    <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="threadG" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#e2c48c"/><stop offset="1" stop-color="#9c7444"/>
  </linearGradient>
  <mask id="monoClaspB" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1080">
    <rect width="1080" height="1080" fill="#fff"/>
    <g transform="translate(${TX},540) scale(${CS})" fill="none" stroke="#000">
      <path d="${paddle}" stroke-width="6"/>
      ${rivetPts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14.5" stroke-width="3.5"/>`).join('')}
      <circle cx="58" cy="0" r="19.5" stroke-width="3.5"/>
      <ellipse cx="-66" cy="0" rx="14" ry="19" fill="#000" stroke="none"/>
    </g>
    <g transform="translate(${TX},540) scale(${CS})"><rect x="-71" y="-12" width="10" height="24" rx="5" fill="#fff"/></g>
  </mask>`;

// stitches along the flap edge
let stitches = '';
for (let y = 150; y <= 940; y += 44) stitches += `<rect x="${TX + 34}" y="${y}" width="9" height="30" rx="4.5" transform="rotate(-24 ${TX + 38.5} ${y + 15})"/>`;
let holes = '';
for (let y = 150; y <= 940; y += 44) holes += `<circle cx="${TX + 44}" cy="${y + 1}" r="3.4"/><circle cx="${TX + 33}" cy="${y + 29}" r="3.4"/>`;

const bg = `
  <rect width="1080" height="1080" fill="url(#leatherB)" filter="url(#grain)"/>
  <g clip-path="url(#coverClipB)">
    <g filter="url(#deboss)"><g transform="translate(${TX},540) scale(1.45)">${mandala()}</g></g>
  </g>
  <g filter="url(#flapShadowB)">
    <rect x="${TX}" y="0" width="${1080 - TX}" height="1080" fill="url(#flapB)" filter="url(#grain2)"/>
  </g>
  <g clip-path="url(#flapClipB)">
    <rect x="${TX}" y="0" width="40" height="1080" fill="url(#edgeB)"/>
    <rect x="${TX + 3}" y="0" width="3" height="1080" fill="#f0b884" opacity="0.32"/>
    <g filter="url(#deboss)">
      <rect x="${TX + 66}" y="0" width="5" height="1080"/>
      ${[[700, 262], [700, 818], [880, 540]].map(([x, y]) => `<g transform="translate(${x},${y}) scale(1.35)">${rosette(48)}</g>`).join('')}
    </g>
    <g fill="#1a0802" opacity="0.8">${holes}</g>
    <g fill="url(#threadG)" filter="url(#thread)">${stitches}</g>
  </g>
  <rect width="1080" height="1080" fill="url(#glowB)"/>
  <rect width="1080" height="1080" fill="url(#vigB)"/>`;

const fg = `<g transform="translate(${TX},540) scale(${CS})">${clasp({ f: 'brassB' })}</g>`;

const mono = `
  <g mask="url(#monoClaspB)"><g transform="translate(${TX},540) scale(${CS})">
    <rect x="-90" y="-64" width="48" height="128" rx="12"/><path d="${hingePlate}"/><path d="${paddle}"/>
  </g></g>`;

fs.writeFileSync('C:/Users/PC/desktop/TO_DO_APP/icon-lab/b.svg', svgDoc(base, bg, fg, mono, extra));
console.log('b.svg written');

// Concept A — "Deri Defter": the closed tooled-leather journal cover, seen frontally, filling the icon.
import fs from 'node:fs';
import { defs, mandala, rosette, star8, clasp, svgDoc, rot, hingePlate, paddle, rivetPts, n } from './common.mjs';

const SX = 610;           // flap seam x
const CS = 1.4;           // clasp scale
const base = defs({ seed: 11 });
const grain2 = base.match(/<filter id="grain"[\s\S]*?<\/filter>/)[0].replace('id="grain"', 'id="grain2"').replace(/seed="(\d+)"/g, (m, s) => `seed="${+s + 40}"`);

const extra = `
  ${grain2}
  <radialGradient id="leatherA" gradientUnits="userSpaceOnUse" cx="470" cy="470" r="620">
    <stop offset="0" stop-color="#b9824c"/><stop offset="0.35" stop-color="#a26a39"/>
    <stop offset="0.62" stop-color="#7c4a22"/><stop offset="1" stop-color="#40210b"/>
  </radialGradient>
  <linearGradient id="flapA" x1="0" y1="0" x2="1" y2="0.4">
    <stop offset="0" stop-color="#9c6536"/><stop offset="0.35" stop-color="#94602f"/><stop offset="1" stop-color="#5d3416"/>
  </linearGradient>
  <radialGradient id="discA" gradientUnits="userSpaceOnUse" cx="${SX}" cy="540" r="318">
    <stop offset="0" stop-color="#2e1404" stop-opacity="0.55"/><stop offset="0.9" stop-color="#2e1404" stop-opacity="0.42"/>
    <stop offset="1" stop-color="#3a1a06" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vigA" gradientUnits="userSpaceOnUse" cx="540" cy="525" r="560">
    <stop offset="0" stop-color="#1e0c03" stop-opacity="0"/><stop offset="0.46" stop-color="#1e0c03" stop-opacity="0"/>
    <stop offset="0.645" stop-color="#1e0c03" stop-opacity="0.5"/><stop offset="0.8" stop-color="#1e0c03" stop-opacity="0.78"/>
    <stop offset="1" stop-color="#140702" stop-opacity="0.92"/>
  </radialGradient>
  <radialGradient id="sheenA" gradientUnits="userSpaceOnUse" cx="400" cy="360" r="380">
    <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.16"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="edgeA" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2a1205" stop-opacity="0.9"/><stop offset="0.35" stop-color="#3a1a08" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#3a1a08" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="coverClip"><rect x="0" y="0" width="${SX}" height="1080"/></clipPath>
  <clipPath id="flapClip"><rect x="${SX}" y="0" width="${1080 - SX}" height="1080"/></clipPath>
  <filter id="flapShadow" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="7"/><feOffset dx="-3" dy="5" result="o"/>
    <feFlood flood-color="#120600" flood-opacity="0.55"/><feComposite in2="o" operator="in" result="s"/>
    <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <mask id="monoCutA" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1080">
    <rect width="1080" height="1080" fill="#fff"/>
    <g transform="translate(${SX},540) scale(${CS})" fill="#000" stroke="#000" stroke-width="16">
      <path d="${hingePlate}"/><path d="${paddle}"/><rect x="-90" y="-64" width="48" height="128" rx="12"/>
    </g>
  </mask>
  <clipPath id="coverClipMonoA"><rect x="0" y="0" width="${SX - 16}" height="1080"/></clipPath>
  <mask id="monoRingsA" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1080">
    <rect width="1080" height="1080" fill="#fff"/>
    <g fill="none" stroke="#000"><circle cx="${SX}" cy="540" r="238" stroke-width="12"/><circle cx="${SX}" cy="540" r="168" stroke-width="14"/></g>
  </mask>
  <mask id="monoClaspA" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1080">
    <rect width="1080" height="1080" fill="#fff"/>
    <g transform="translate(${SX},540) scale(${CS})" fill="none" stroke="#000">
      <path d="${paddle}" stroke-width="9"/>
      ${rivetPts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" stroke-width="5"/>`).join('')}
      <circle cx="58" cy="0" r="20" stroke-width="5"/>
      <ellipse cx="-66" cy="0" rx="14" ry="19" fill="#000" stroke="none"/>
    </g>
    <g transform="translate(${SX},540) scale(${CS})"><rect x="-71" y="-12" width="10" height="24" rx="5" fill="#fff"/></g>
  </mask>`;

// tooled border band (two lines + small diamonds) around the visible square
function border() {
  let s = `<rect x="198" y="198" width="684" height="684" rx="26" fill="none" stroke="#000" stroke-width="5"/>
           <rect x="226" y="226" width="628" height="628" rx="14" fill="none" stroke="#000" stroke-width="4"/>`;
  for (let t = 250; t <= 830; t += 29) {
    for (const [x, y] of [[t, 212], [t, 868], [212, t], [868, t]]) s += `<path d="M${x - 7},${y}L${x},${y - 7}L${x + 7},${y}L${x},${y + 7}Z"/>`;
  }
  return s;
}

const stars = (cx, cy, flip) => `<g transform="translate(${cx},${cy}) scale(1,${flip})">
   <g transform="translate(0,0)">${star8(30)}</g><g transform="translate(56,-40)">${star8(17)}</g><g transform="translate(-40,56)">${star8(17)}</g>
   <circle cx="44" cy="20" r="5"/><circle cx="20" cy="44" r="5"/></g>`;

const bg = `
  <rect width="1080" height="1080" fill="url(#leatherA)" filter="url(#grain)"/>
  <g clip-path="url(#coverClip)">
    <circle cx="${SX}" cy="540" r="318" fill="url(#discA)"/>
    <g filter="url(#deboss)"><g transform="translate(${SX},540)">${mandala()}</g></g>
    <g filter="url(#deboss)">${stars(332, 300, 1)}${stars(332, 780, -1)}${border()}</g>
  </g>
  <g filter="url(#flapShadow)">
    <rect x="${SX}" y="0" width="${1080 - SX}" height="1080" fill="url(#flapA)" filter="url(#grain2)"/>
  </g>
  <g clip-path="url(#flapClip)">
    <rect x="${SX}" y="0" width="34" height="1080" fill="url(#edgeA)"/>
    <rect x="${SX + 3}" y="0" width="2.5" height="1080" fill="#e8b47a" opacity="0.35"/>
    <g filter="url(#deboss)">
      ${border()}
      <rect x="${SX + 30}" y="226" width="4" height="628"/>
      ${[540, 410, 670, 280, 800].map(y => `<g transform="translate(784,${y})">${rosette(48)}</g>`).join('')}
    </g>
  </g>
  <rect width="1080" height="1080" fill="url(#sheenA)"/>
  <rect width="1080" height="1080" fill="url(#vigA)"/>`;

const fg = `<g transform="translate(${SX},540) scale(${CS})">${clasp()}</g>`;

// monochrome: scalloped half-mandala (with two ring gaps) + flap seam + clasp silhouette
const mono = `
  <g mask="url(#monoCutA)">
    <g clip-path="url(#coverClipMonoA)">
      <g fill="none" stroke="#fff">
        <circle cx="${SX}" cy="540" r="284" stroke-width="30"/>
        <circle cx="${SX}" cy="540" r="222" stroke-width="30"/>
        <circle cx="${SX}" cy="540" r="160" stroke-width="30"/>
      </g>
      ${rot(36, a => `<circle cx="${SX}" cy="${540 - 253}" r="8.5" transform="rotate(${a} ${SX} 540)"/>`, 5)}
    </g>
    <rect x="${SX + 2}" y="236" width="22" height="608" rx="11"/>
  </g>
  <g mask="url(#monoClaspA)"><g transform="translate(${SX},540) scale(${CS})">
    <rect x="-90" y="-64" width="48" height="128" rx="12"/><path d="${hingePlate}"/><path d="${paddle}"/>
  </g></g>`;

fs.writeFileSync('C:/Users/PC/desktop/TO_DO_APP/icon-lab/a.svg', svgDoc(base, bg, fg, mono, extra));
console.log('a.svg written');

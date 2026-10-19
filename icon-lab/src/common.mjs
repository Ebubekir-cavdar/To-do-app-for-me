// Shared hand-written SVG building blocks for the "Görev Defteri" icon concepts.
// Canvas: 1080x1080 user units = 108dp adaptive canvas (10 units = 1dp).
// Visible (masked) area: central 720x720 (72dp). Safe zone: circle r=330 (66dp) around (540,540).

export const n = v => +(+v).toFixed(2);
export const rot = (count, fn, offset = 0) => { let s = ''; for (let i = 0; i < count; i++) s += fn(n(offset + i * 360 / count), i); return s; };

// ---------- defs ----------
export function defs({ seed = 11, grainFreq = 0.45, grainScale = 2.2, mottle = 1 } = {}) {
  return `
  <linearGradient id="brassG" x1="0" y1="0" x2="0.85" y2="1">
    <stop offset="0" stop-color="#f8e7a8"/><stop offset="0.16" stop-color="#d9b45e"/>
    <stop offset="0.38" stop-color="#8a6224"/><stop offset="0.56" stop-color="#c39a48"/>
    <stop offset="0.72" stop-color="#ecd088"/><stop offset="0.88" stop-color="#93692b"/>
    <stop offset="1" stop-color="#4f3510"/>
  </linearGradient>
  <linearGradient id="brassG2" x1="0" y1="0" x2="0.15" y2="1">
    <stop offset="0" stop-color="#fbeab0"/><stop offset="0.22" stop-color="#d8b360"/>
    <stop offset="0.5" stop-color="#7f5b21"/><stop offset="0.66" stop-color="#b48a3c"/>
    <stop offset="0.86" stop-color="#e6c67a"/><stop offset="1" stop-color="#6b4f1e"/>
  </linearGradient>
  <radialGradient id="rivetG" cx="0.5" cy="0.5" r="0.5" fx="0.34" fy="0.3">
    <stop offset="0" stop-color="#fffbe6"/><stop offset="0.18" stop-color="#f1d58a"/>
    <stop offset="0.5" stop-color="#b68a3a"/><stop offset="0.85" stop-color="#5e4215"/>
    <stop offset="1" stop-color="#3a270a"/>
  </radialGradient>
  <radialGradient id="holeG" cx="0.5" cy="0.5" r="0.5" fx="0.6" fy="0.66">
    <stop offset="0" stop-color="#0d0702"/><stop offset="0.7" stop-color="#1f1206"/><stop offset="1" stop-color="#4a3312"/>
  </radialGradient>

  <!-- leather grain: fine pores + soft creases lit from top-left, plus darker mottling -->
  <filter id="grain" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency="${grainFreq}" numOctaves="3" seed="${seed}" result="n1"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.028" numOctaves="2" seed="${seed + 3}" result="n2"/>
    <feComposite in="n1" in2="n2" operator="arithmetic" k2="0.55" k3="0.6" k4="-0.1" result="h"/>
    <feDiffuseLighting in="h" surfaceScale="${grainScale}" diffuseConstant="1" lighting-color="#fff" result="L">
      <feDistantLight azimuth="225" elevation="58"/>
    </feDiffuseLighting>
    <feComposite in="SourceGraphic" in2="L" operator="arithmetic" k1="1.17" result="g"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.0065" numOctaves="3" seed="${seed + 7}" result="m"/>
    <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.17  0 0 0 0 0.075  0 0 0 0 0.02  0 0 0 ${n(2.6 * mottle)} ${n(-1.12 * mottle)}" result="blot"/>
    <feComposite in="blot" in2="g" operator="over" result="g2"/>
    <feComposite in="g2" in2="SourceAlpha" operator="in"/>
  </filter>

  <!-- tooled (debossed) leather: darker pressed shapes, shadow on upper-left walls, light on lower-right -->
  <filter id="deboss" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"/>
    <feDiffuseLighting in="b" surfaceScale="-5" diffuseConstant="1" lighting-color="#fff" result="L">
      <feDistantLight azimuth="225" elevation="50"/>
    </feDiffuseLighting>
    <feColorMatrix in="L" type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.74  3.0 0 0 0 -2.30" result="hi"/>
    <feColorMatrix in="L" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.035  0 0 0 0 0.01  -3.6 0 0 0 2.76" result="lo"/>
    <feFlood flood-color="#2a1305" flood-opacity="0.5"/>
    <feComposite in2="SourceAlpha" operator="in" result="fill"/>
    <feMerge><feMergeNode in="fill"/><feMergeNode in="lo"/><feMergeNode in="hi"/></feMerge>
  </filter>
  <!-- gold-leaf tooling (C): gilded, slightly sunk -->
  <filter id="gilt" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b"/>
    <feSpecularLighting in="b" surfaceScale="-3" specularConstant="1.1" specularExponent="14" lighting-color="#fff4cf" result="s">
      <feDistantLight azimuth="225" elevation="40"/>
    </feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
    <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k2="1" k3="0.8" result="g"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="sb"/><feOffset in="sb" dx="-1.5" dy="-2" result="so"/>
    <feFlood flood-color="#1a0b02" flood-opacity="0.7"/><feComposite in2="so" operator="in" result="sh"/>
    <feMerge><feMergeNode in="sh"/><feMergeNode in="g"/></feMerge>
  </filter>

  ${brassFilter('brass')}
  <filter id="dshadow" color-interpolation-filters="sRGB" x="-40%" y="-40%" width="190%" height="190%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="sb"/><feOffset in="sb" dx="3" dy="4" result="so"/>
    <feFlood flood-color="#120802" flood-opacity="0.65"/><feComposite in2="so" operator="in" result="shadow"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;
}

// cast metal: bevel + specular + fine patina + drop shadow. Params are in the user units of the element it is applied to.
export function brassFilter(id, { blur = 3.4, ss = 4, pf = 0.05, pat = 0.5, sx = 5, sy = 8, sb = 5, so = 0.62, spec = 0.75 } = {}) {
  return `<filter id="${id}" color-interpolation-filters="sRGB" x="-30%" y="-30%" width="170%" height="170%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>
    <feDiffuseLighting in="b" surfaceScale="${ss}" diffuseConstant="1" lighting-color="#fff" result="d">
      <feDistantLight azimuth="225" elevation="42"/>
    </feDiffuseLighting>
    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.42" result="lit"/>
    <feSpecularLighting in="b" surfaceScale="${ss}" specularConstant="1.5" specularExponent="42" lighting-color="#fff1c4" result="s">
      <feDistantLight azimuth="225" elevation="42"/>
    </feSpecularLighting>
    <feComposite in="lit" in2="s" operator="arithmetic" k2="1" k3="${spec}" result="ls"/>
    <feTurbulence type="fractalNoise" baseFrequency="${pf}" numOctaves="4" seed="21" result="pn"/>
    <feColorMatrix in="pn" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.11  0 0 0 0 0.03  0 0 0 ${3 * pat} ${-1.35 * pat}" result="pat"/>
    <feComposite in="pat" in2="ls" operator="over" result="lp"/>
    <feComposite in="lp" in2="SourceAlpha" operator="in" result="metal"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="${sb}" result="sb"/><feOffset in="sb" dx="${sx}" dy="${sy}" result="so"/>
    <feFlood flood-color="#120802" flood-opacity="${so}"/><feComposite in2="so" operator="in" result="shadow"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="metal"/></feMerge>
  </filter>`;
}

// ---------- tooled ornaments (solid shapes; colour comes from the deboss/gilt filter) ----------
export const ring = (r, w) => `<circle r="${r}" fill="none" stroke="#000" stroke-width="${w}"/>`;

export function mandala() {
  let s = '';
  s += rot(12, a => `<circle cx="0" cy="-86" r="9" transform="rotate(${a})"/>`);
  s += ring(108, 5);
  s += rot(24, a => `<path d="M0,-117C11,-127 11,-149 0,-161C-11,-149 -11,-127 0,-117Z" transform="rotate(${a})"/>`);
  s += ring(171, 5);
  s += rot(36, a => `<path d="M-14.5,-180L0,-211L14.5,-180Z" transform="rotate(${a})"/>`);
  s += ring(221, 4);
  s += rot(20, a => `<g transform="rotate(${a})"><ellipse cx="0" cy="-248" rx="16" ry="19" fill="none" stroke="#000" stroke-width="5"/><circle cx="0" cy="-248" r="5"/></g>`);
  s += ring(274, 3.5);
  s += rot(36, a => `<path d="M-12,-279L0,-308L12,-279Z" transform="rotate(${a})"/>`);
  s += rot(36, a => `<circle cx="0" cy="-292" r="4" transform="rotate(${a})"/>`, 5);
  return s;
}

export function rosette(r = 46) {
  const k = r / 46;
  return `<g transform="scale(${n(k)})">${rot(8, a => `<path d="M0,-13C9,-18 15,-30 0,-44C-15,-30 -9,-18 0,-13Z" transform="rotate(${a})"/>`)}${rot(8, a => `<circle cx="0" cy="-40" r="3.2" transform="rotate(${a})"/>`, 22.5)}<circle r="8"/></g>`;
}

export function star8(r = 30) {
  let d = '';
  for (let i = 0; i < 16; i++) { const a = (i * 22.5 - 90) * Math.PI / 180, rr = i % 2 ? r * 0.5 : r; d += (i ? 'L' : 'M') + n(rr * Math.cos(a)) + ',' + n(rr * Math.sin(a)); }
  return `<path d="${d}Z"/>`;
}

// ---------- brass clasp (local coords; origin = flap seam centre) ----------
export const hingePlate = 'M-6,-64Q-6,-77 7,-77L113,-77Q126,-77 126,-64Q106,0 126,64Q126,77 113,77L7,77Q-6,77 -6,64Q14,0 -6,-64Z';
export const hingeInner = 'M6,-62L108,-62Q92,0 108,62L6,62Q22,0 6,-62Z';
export const paddle = 'M58,-27C30,-27 12,-16 -12,-16C-30,-16 -40,-37 -66,-37C-92,-37 -105,-18 -105,0C-105,18 -92,37 -66,37C-40,37 -30,16 -12,16C12,16 30,27 58,27C74,27 86,14 86,0C86,-14 74,-27 58,-27Z';
export const rivetPts = [[15, -57], [105, -57], [15, 57], [105, 57]];

export function clasp({ f = 'brass', r = 'dshadow' } = {}) {
  return `
  <g class="clasp">
    <rect x="-90" y="-64" width="48" height="128" rx="12" fill="url(#brassG)" filter="url(#${f})"/>
    <circle cx="-66" cy="-49" r="7" fill="url(#rivetG)" filter="url(#${r})"/><circle cx="-66" cy="49" r="7" fill="url(#rivetG)" filter="url(#${r})"/>
    <path d="${hingePlate}" fill="url(#brassG)" filter="url(#${f})"/>
    <path d="${hingeInner}" fill="none" stroke="#4a3312" stroke-opacity="0.55" stroke-width="3"/>
    <path d="${hingeInner}" fill="none" stroke="#fff1c4" stroke-opacity="0.35" stroke-width="2" transform="translate(1.5,2)"/>
    ${rivetPts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12.5" fill="url(#rivetG)" filter="url(#${r})"/>`).join('')}
    <path d="${paddle}" fill="url(#brassG2)" filter="url(#${f})"/>
    <path d="M38,-15C20,-14 8,-8 -12,-8" fill="none" stroke="#fff3c8" stroke-opacity="0.4" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="-66" cy="0" rx="14" ry="19" fill="url(#holeG)"/>
    <rect x="-73" y="-15" width="14" height="30" rx="7" fill="url(#rivetG)" filter="url(#${r})"/>
    <circle cx="58" cy="0" r="17" fill="url(#rivetG)" filter="url(#${r})"/>
  </g>`;
}

export function svgDoc(defsStr, bg, fg, mono, extraDefs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
<defs>${defsStr}${extraDefs}</defs>
<g id="bg">${bg}</g>
<g id="fg">${fg}</g>
<g id="mono" fill="#fff">${mono}</g>
</svg>
`;
}

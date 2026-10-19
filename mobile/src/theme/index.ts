/**
 * Theme tokens ported from designs/final.html. Gradients and shadows are CSS strings
 * for React Native's `backgroundImage` / `boxShadow` style props (RN 0.88, also
 * passed straight through by react-native-web). Every gradient surface also sets a
 * solid `backgroundColor` fallback.
 */
export { C, TINCT, dimColor } from './colors';
export { F, fontAssets } from './fonts';

export const G = {
  /** .app column background */
  app: 'radial-gradient(130% 55% at 50% 0%, #2b333d 0%, #181c22 55%, #111418 100%)',
  page: 'radial-gradient(circle at 50% 30%, #1c2229 0%, #0b0d10 70%)',
  topbar: 'linear-gradient(180deg, #323b46 0%, #1b2027 70%, #15191e 100%)',
  resItem: 'linear-gradient(180deg, #14181d 0%, #252c35 100%)',
  meterFill: 'linear-gradient(180deg, #b4ec86 0%, #57a83a 55%, #2c621d 100%)',
  metal: 'linear-gradient(180deg, #5d6876 0%, #36404b 48%, #262d36 52%, #323b46 100%)',
  metalDown: 'linear-gradient(180deg, #262d36 0%, #323b46 100%)',
  goldFrame: 'linear-gradient(135deg, #f6e3a1 0%, #6b4f1e 26%, #d4ad57 50%, #3a2a10 76%, #c9a24e 100%)',
  goldFrameToday: 'linear-gradient(135deg, #fff6cf 0%, #c9a24e 28%, #fff0b5 50%, #a9823a 76%, #ffe9a0 100%)',
  dwFace: 'linear-gradient(180deg, #0c0f13 0%, #1b2129 100%)',
  pipPast: 'linear-gradient(135deg, #f0d38a 0%, #8a6a2c 100%)',
  pipNow: 'radial-gradient(circle, #d8ff9e 0%, #57a83a 60%, #1d3a15 100%)',
  prov: 'linear-gradient(180deg, #262d36 0%, #1b2128 100%)',
  provToday: 'linear-gradient(180deg, #28313b 0%, #1b2128 100%)',
  provHead: 'linear-gradient(180deg, #414c5a 0%, #2a323c 60%, #232a32 100%)',
  provHeadPast: 'linear-gradient(180deg, #363f4a 0%, #252b33 60%, #1f252c 100%)',
  provHeadToday: 'linear-gradient(180deg, #4c5f45 0%, #2f3d2c 60%, #263224 100%)',
  ribbon: 'linear-gradient(180deg, #fdf0bd 0%, #d9ad55 60%, #b78a36 100%)',
  alert: 'linear-gradient(180deg, #5a1f18 0%, #3a120d 55%, #2c0e0a 100%)',
  ledger:
    'radial-gradient(60% 50% at 85% 20%, rgba(150,110,50,0.18) 0%, rgba(150,110,50,0) 70%), ' +
    'radial-gradient(50% 60% at 10% 90%, rgba(140,100,40,0.16) 0%, rgba(140,100,40,0) 70%), ' +
    'linear-gradient(180deg, #f0e2bd 0%, #e2cd9c 100%)',
  box: 'linear-gradient(180deg, #636e7b 0%, #2a3139 100%)',
  boxDone: 'linear-gradient(180deg, #3a6d29 0%, #16300e 100%)',
  boxLate: 'linear-gradient(180deg, #8a3024 0%, #3e0e09 100%)',
  rowLate: 'linear-gradient(90deg, rgba(192,48,31,0.22) 0%, rgba(192,48,31,0.06) 70%, rgba(192,48,31,0.06) 100%)',
  lateChip: 'linear-gradient(180deg, #d8432c 0%, #8a160b 100%)',
  /** Failed task: charcoal checkbox bleeding into dark blood red, and the near-black "Başarısız" chip. */
  boxFailed: 'linear-gradient(180deg, #4a1a14 0%, #1c0907 60%, #120605 100%)',
  failChip: 'linear-gradient(180deg, #2c1411 0%, #0f0706 100%)',
  logLine: 'linear-gradient(90deg, rgba(14,17,22,0.88) 0%, rgba(14,17,22,0.62) 100%)',
  scrim: 'radial-gradient(ellipse at 50% 40%, rgba(10,12,15,0.55) 0%, rgba(4,5,7,0.9) 100%)',
  event: 'linear-gradient(180deg, #2c343e 0%, #1a1f26 100%)',
  evTitle: 'linear-gradient(180deg, #46525f 0%, #262d36 100%)',
  evBody: 'linear-gradient(180deg, #f0e2bd 0%, #e0ca98 100%)',
  opt: 'linear-gradient(180deg, #4f5b69 0%, #2f3741 50%, #262d36 52%, #2e3640 100%)',
  optDanger: 'linear-gradient(180deg, #6a2a22 0%, #45160f 50%, #3a110c 52%, #46170f 100%)',
  oiYes: 'linear-gradient(180deg, #3a6d29 0%, #16300e 100%)',
  oiNo: 'linear-gradient(180deg, #5d6876 0%, #2a3139 100%)',
  oiDanger: 'linear-gradient(180deg, #b8382a 0%, #5e0f0b 100%)',
} as const;

export const SH = {
  app: '0 0 0 1px #000, 0 0 0 3px #2a2216, 0 0 50px rgba(0,0,0,0.8)',
  topbar: '0 2px 0 #000, 0 8px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
  resItem: 'inset 0 0 0 1px rgba(212,173,87,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
  resUnrest: 'inset 0 0 0 1px rgba(255,106,82,0.5), inset 0 0 10px rgba(192,48,31,0.35)',
  meter: 'inset 0 0 0 1px rgba(212,173,87,0.32)',
  metal: '0 0 0 1px #050607, inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.45)',
  metalDown: '0 0 0 1px #050607, inset 0 2px 4px rgba(0,0,0,0.6)',
  dwFace: '0 0 0 1px #000',
  /** Date plaque while another week is shown: it glows to invite "back to today". */
  dwFaceAway: '0 0 0 1px #000, 0 0 10px 1px rgba(246,227,161,0.5)',
  dwFaceInner: 'inset 0 0 12px rgba(0,0,0,0.8)',
  pip: 'inset 0 0 0 1px rgba(212,173,87,0.35)',
  pipNow: '0 0 6px #9be06f, inset 0 0 0 1px rgba(0,0,0,0.4)',
  prov: '0 0 0 1px #050607, 0 6px 14px rgba(0,0,0,0.55)',
  provToday: '0 0 0 1px #050607, 0 0 0 4px rgba(246,227,161,0.16), 0 0 24px rgba(246,227,161,0.3), 0 6px 14px rgba(0,0,0,0.55)',
  provHead: 'inset 0 1px 0 rgba(255,255,255,0.13), 0 1px 0 rgba(212,173,87,0.35)',
  tally: 'inset 0 0 0 1px rgba(212,173,87,0.35)',
  alert: '0 0 0 1px #000, inset 0 1px 0 rgba(255,255,255,0.15), 0 0 12px rgba(192,48,31,0.35)',
  ledger: 'inset 0 0 0 1px rgba(58,40,20,0.55), inset 0 0 18px rgba(110,78,36,0.5), 0 1px 0 rgba(255,255,255,0.08)',
  box: 'inset 0 0 0 1px #a9823a, inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -3px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.5)',
  boxDown: 'inset 0 0 0 1px #a9823a, inset 0 3px 5px rgba(0,0,0,0.6)',
  boxLate: 'inset 0 0 0 1px #ff6a52, inset 0 2px 0 rgba(255,255,255,0.2), inset 0 -3px 4px rgba(0,0,0,0.5), 0 0 6px rgba(192,48,31,0.6)',
  rowLate: 'inset 4px 0 0 #c0301f',
  boxFailed: 'inset 0 0 0 1px #7a1a10, inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -3px 4px rgba(0,0,0,0.6)',
  event: '0 0 0 1px #000, 0 0 0 5px rgba(20,24,29,0.85), 0 0 0 6px #6b4f1e, 0 18px 40px rgba(0,0,0,0.8)',
  evTitle: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 0 #000',
  evIllus: '0 0 0 1px #000, inset 0 0 0 1px #000',
  evBody: 'inset 0 0 0 1px rgba(58,40,20,0.55), inset 0 0 16px rgba(110,78,36,0.45)',
  inp: 'inset 0 2px 4px rgba(80,55,20,0.32)',
  inpErr: 'inset 0 0 0 1px #c0301f, inset 0 2px 4px rgba(80,55,20,0.3)',
  opt: '0 0 0 1px #050607, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.45)',
  optDown: '0 0 0 1px #050607, inset 0 2px 5px rgba(0,0,0,0.6)',
  oi: 'inset 0 0 0 1px #a9823a, inset 0 1px 0 rgba(255,255,255,0.25)',
  oiDanger: 'inset 0 0 0 1px #ff9a85',
} as const;

/** text-shadow: 0 1px 0 #000 */
export const TS = {
  textShadowColor: '#000',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 0,
} as const;

/** cubic-bezier(.2,.7,.2,1) etc. as plain tuples for Easing.bezier. */
export const EASE = {
  slide: [0.2, 0.7, 0.2, 1] as const,
  pop: [0.2, 0.8, 0.2, 1.1] as const,
  tick: [0.3, 1.6, 0.5, 1] as const,
};

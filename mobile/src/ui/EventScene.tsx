import { memo, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { C, SH } from '../theme';

/**
 * False while a newly mounted vignette commits its first frame, true from the next one. A popup
 * mounts its whole content when it opens (RN Modal renders nothing while hidden), and a vignette
 * is some 50–70 SVG nodes, a large share of a popup's views: drawing it one frame later lets the
 * window itself appear sooner. That first frame is the very start of the popup's fade-in (practically
 * transparent), and the frame keeps its size and colour meanwhile, so nothing visibly changes.
 * With reduced motion there is no fade, so the vignette is drawn at once as before.
 */
export function useAfterFirstFrame(): boolean {
  const reduced = useReducedMotion();
  // Once drawn it stays drawn (also if reduced motion is switched off while the popup is open).
  const [ready, setReady] = useState(reduced);
  const show = ready || reduced;
  useEffect(() => {
    if (show) return;
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [show]);
  return show;
}

/** .ev-illus frame; its drawing is mounted from the second frame on (useAfterFirstFrame). */
function Illus({ children }: { children: ReactNode }) {
  const show = useAfterFirstFrame();
  return <View style={s.illus}>{show ? children : null}</View>;
}

/** .ev-illus — the castle-at-dusk vignette of the add-task event (final.html). */
export const EventScene = memo(function EventScene() {
  return (
    <Illus>
      <Svg width="100%" height="100%" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="evSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7f6c4b" />
            <Stop offset="0.55" stopColor="#d4b273" />
            <Stop offset="1" stopColor="#f0dba6" />
          </LinearGradient>
          <RadialGradient id="evSun" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#fff5cf" />
            <Stop offset="0.55" stopColor="#f6dc96" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#f6dc96" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="evVig" cx="0.5" cy="0.45" r="0.72">
            <Stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#1a1006" stopOpacity="0.7" />
          </RadialGradient>
          <Pattern id="evHatch" width="4" height="4" patternUnits="userSpaceOnUse">
            <Path d="M0 4L4 0" stroke="#3a2810" strokeOpacity="0.13" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="320" height="112" fill="url(#evSky)" />
        <Circle cx="236" cy="60" r="36" fill="url(#evSun)" />
        <Path d="M0 80C40 66 70 72 104 66c36-6 66 8 106 2 40-6 75 2 110-4v48H0z" fill="#a4855a" opacity="0.75" />
        <G fill="#3a2e1d">
          <Rect x="95" y="58" width="18" height="34" />
          <Rect x="95" y="53" width="4" height="6" />
          <Rect x="102" y="53" width="4" height="6" />
          <Rect x="109" y="53" width="4" height="6" />
          <Rect x="112" y="70" width="38" height="22" />
          <Rect x="114" y="66" width="4" height="5" />
          <Rect x="138" y="66" width="4" height="5" />
          <Rect x="145" y="66" width="4" height="5" />
          <Rect x="121" y="46" width="22" height="46" />
          <Rect x="121" y="41" width="4" height="6" />
          <Rect x="127" y="41" width="4" height="6" />
          <Rect x="133" y="41" width="4" height="6" />
          <Rect x="139" y="41" width="4" height="6" />
          <Rect x="149" y="62" width="14" height="30" />
          <Rect x="149" y="58" width="4" height="5" />
          <Rect x="154" y="58" width="4" height="5" />
          <Rect x="159" y="58" width="4" height="5" />
        </G>
        <Path d="M132 41V24" stroke="#3a2e1d" strokeWidth="1.6" />
        <Path d="M132.8 24.5l18 3.5-18 5z" fill="#9b2b1f" />
        <G fill="#f3d58b" opacity="0.85">
          <Rect x="102" y="66" width="3" height="6" />
          <Rect x="130" y="55" width="4" height="7" />
          <Rect x="155" y="70" width="3" height="5" />
        </G>
        <Path d="M127 92v-8a5 5 0 0 1 10 0v8z" fill="#1e170d" />
        <Path d="M0 96c50-10 90-6 130-12 40-6 70 4 110 6 30 2 60-4 80-2v24H0z" fill="#6c5533" />
        <Path d="M196 28q4-4 8 0q4-4 8 0M218 38q3-3 6 0q3-3 6 0" fill="none" stroke="#4a3b25" strokeWidth="1.3" />
        <Rect x="222" y="90" width="72" height="16" rx="2" fill="#f1dfb2" stroke="#5a4320" strokeWidth="1.2" />
        <Circle cx="222" cy="98" r="8" fill="#d8c08a" stroke="#5a4320" strokeWidth="1.2" />
        <Circle cx="294" cy="98" r="8" fill="#d8c08a" stroke="#5a4320" strokeWidth="1.2" />
        <Path d="M234 95h46M234 100h36" stroke="#8a6f45" strokeWidth="1.2" />
        <Path d="M306 54c-12 6-28 24-36 40l3 1.5c11-14 25-28 37-38z" fill="#f4ead0" stroke="#5a4320" strokeWidth="1" />
        <Path d="M273 94l-4 9" stroke="#2a1d08" strokeWidth="1.6" />
        <Rect width="320" height="112" fill="url(#evHatch)" />
        <Rect width="320" height="112" fill="url(#evVig)" />
      </Svg>
    </Illus>
  );
});

/** Ferman popup vignette: a decree scroll with tughra and wax seal on the divan desk. */
export const FermanScene = memo(function FermanScene() {
  return (
    <Illus>
      <Svg width="100%" height="100%" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="fmWall" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5a4428" />
            <Stop offset="0.6" stopColor="#9c7c4c" />
            <Stop offset="1" stopColor="#c9a86c" />
          </LinearGradient>
          <RadialGradient id="fmGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#fff2c4" stopOpacity="0.95" />
            <Stop offset="0.5" stopColor="#f6dc96" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#f6dc96" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="fmDesk" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6b4826" />
            <Stop offset="1" stopColor="#2e1d0d" />
          </LinearGradient>
          <LinearGradient id="fmRoll" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#efdcab" />
            <Stop offset="0.5" stopColor="#c9ad74" />
            <Stop offset="1" stopColor="#8a6f45" />
          </LinearGradient>
          <RadialGradient id="fmSeal" cx="0.38" cy="0.32" r="0.75">
            <Stop offset="0" stopColor="#e2584a" />
            <Stop offset="0.6" stopColor="#a3201a" />
            <Stop offset="1" stopColor="#4e0c08" />
          </RadialGradient>
          <RadialGradient id="fmVig" cx="0.5" cy="0.45" r="0.72">
            <Stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#1a1006" stopOpacity="0.7" />
          </RadialGradient>
          <Pattern id="fmHatch" width="4" height="4" patternUnits="userSpaceOnUse">
            <Path d="M0 4L4 0" stroke="#3a2810" strokeOpacity="0.13" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="320" height="112" fill="url(#fmWall)" />
        {/* pointed arches of the divan hall */}
        <G fill="#3a2a16" opacity="0.45">
          <Path d="M14 86V40c0-14 12-24 22-30 10 6 22 16 22 30v46z" />
          <Path d="M262 86V40c0-14 12-24 22-30 10 6 22 16 22 30v46z" />
        </G>
        <G fill="none" stroke="#e9cf8e" strokeOpacity="0.35" strokeWidth="1.2">
          <Path d="M20 86V41c0-11 9-19 16-24 7 5 16 13 16 24v45" />
          <Path d="M268 86V41c0-11 9-19 16-24 7 5 16 13 16 24v45" />
        </G>
        <Circle cx="160" cy="48" r="70" fill="url(#fmGlow)" />
        {/* desk */}
        <Rect x="0" y="88" width="320" height="24" fill="url(#fmDesk)" />
        <Rect x="0" y="88" width="320" height="2" fill="#8a6234" />
        {/* the decree */}
        <Path d="M110 16h100v70H110z" fill="#f4e6c0" stroke="#5a4320" strokeWidth="1.2" />
        <Rect x="102" y="9" width="116" height="10" rx="5" fill="url(#fmRoll)" stroke="#5a4320" strokeWidth="1.2" />
        <Rect x="102" y="83" width="116" height="10" rx="5" fill="url(#fmRoll)" stroke="#5a4320" strokeWidth="1.2" />
        {/* tughra */}
        <G fill="none" strokeLinecap="round">
          <Path d="M146 44V23M152 44V21M158 44V24" stroke="#24366e" strokeWidth="1.8" />
          <Path d="M141 44c-16-1-17-13-4-12 16 1 32 5 46 12" stroke="#24366e" strokeWidth="1.8" />
          <Path d="M139 41c-9 0-10-6-3-6 12 0 24 3 34 9" stroke="#b8862c" strokeWidth="1.1" />
          <Path d="M150 44c4 2 14 2 22-2" stroke="#24366e" strokeWidth="1.4" />
        </G>
        <Path d="M122 53h76M122 59h76M122 65h76M122 71h48" stroke="#8a6f45" strokeWidth="1.2" />
        {/* seal with ribbons */}
        <Path d="M190 82l-5 24 6-4 4 6 2-24zM204 82l5 24-6-4-4 6-2-24z" fill="#7a1a12" stroke="#3a0805" strokeWidth="0.9" />
        <Circle cx="197" cy="78" r="10" fill="url(#fmSeal)" stroke="#4e0c08" strokeWidth="1.2" />
        <Circle cx="197" cy="78" r="6.4" fill="none" stroke="#f0a090" strokeOpacity="0.75" strokeWidth="1" />
        <Path d="M193.4 80.6l1.2-5 2.4 2.6 2.4-2.6 1.2 5z" fill="#ffd9c8" fillOpacity="0.9" />
        {/* inkwell and quill */}
        <Path d="M62 90c-6 0-8-3-8-7 0-3 3-5 4-6h12c1 1 4 3 4 6 0 4-2 7-8 7z" fill="#22252b" stroke="#0c0d10" strokeWidth="1" />
        <Rect x="59" y="73" width="10" height="5" fill="#3a3f47" stroke="#0c0d10" strokeWidth="0.8" />
        <Path d="M66 74C70 58 82 40 98 28c-6 12-14 30-26 46z" fill="#f4ead0" stroke="#5a4320" strokeWidth="1" />
        <Path d="M66 74L94 32" stroke="#8a6f45" strokeWidth="0.8" />
        {/* candle */}
        <Rect x="250" y="62" width="9" height="26" fill="#efe2c0" stroke="#5a4320" strokeWidth="1" />
        <Path d="M244 88h21v-3h-21z" fill="#b8862c" stroke="#3a2a10" strokeWidth="0.8" />
        <Circle cx="254.5" cy="52" r="14" fill="url(#fmGlow)" />
        <Path d="M254.5 46c2.6 3.4 3.6 6 3.6 8a3.6 3.6 0 0 1-7.2 0c0-2 1-4.6 3.6-8z" fill="#ffd36a" stroke="#c0601f" strokeWidth="0.6" />
        <Path d="M254.5 62v-4" stroke="#2a1d08" strokeWidth="1" />
        <Rect width="320" height="112" fill="url(#fmHatch)" />
        <Rect width="320" height="112" fill="url(#fmVig)" />
      </Svg>
    </Illus>
  );
});

/** Notifications explainer vignette: a mounted courier riding out at sunrise (09:00). */
export const CourierScene = memo(function CourierScene() {
  return (
    <Illus>
      <Svg width="100%" height="100%" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="crSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8a7a5c" />
            <Stop offset="0.5" stopColor="#e0bd7a" />
            <Stop offset="1" stopColor="#f6e2ae" />
          </LinearGradient>
          <RadialGradient id="crSun" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#fff6d2" />
            <Stop offset="0.5" stopColor="#ffe29a" stopOpacity="0.8" />
            <Stop offset="1" stopColor="#ffe29a" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="crVig" cx="0.5" cy="0.45" r="0.72">
            <Stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#1a1006" stopOpacity="0.7" />
          </RadialGradient>
          <Pattern id="crHatch" width="4" height="4" patternUnits="userSpaceOnUse">
            <Path d="M0 4L4 0" stroke="#3a2810" strokeOpacity="0.13" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="320" height="112" fill="url(#crSky)" />
        {/* sunrise */}
        <Circle cx="64" cy="76" r="44" fill="url(#crSun)" />
        <Circle cx="64" cy="76" r="13" fill="#fff1c4" opacity="0.9" />
        <G stroke="#fff1c4" strokeOpacity="0.5" strokeWidth="1.4">
          <Path d="M64 52v-10M46 60l-7-7M82 60l7-7M40 76H29M88 76h11" />
        </G>
        {/* distant hills and a watchtower */}
        <Path d="M0 78c30-10 60-8 92-2 34 6 60-8 96-10 40-2 70 8 132 4v42H0z" fill="#a98b5c" opacity="0.8" />
        <G fill="#5a4630" opacity="0.85">
          <Rect x="262" y="52" width="10" height="24" />
          <Rect x="260" y="48" width="3" height="5" />
          <Rect x="265.5" y="48" width="3" height="5" />
          <Rect x="271" y="48" width="3" height="5" />
        </G>
        {/* road */}
        <Path d="M0 94c60-8 120-10 180-8s110 6 140 2v24H0z" fill="#7a5f3a" />
        <Path d="M0 100c70-6 150-7 220-4 40 2 70 3 100 0" fill="none" stroke="#c9a874" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="6 5" />
        {/* dust behind the horse */}
        <G fill="#d9bf8c" opacity="0.6">
          <Circle cx="112" cy="88" r="5" />
          <Circle cx="102" cy="84" r="3.5" />
          <Circle cx="94" cy="89" r="2.6" />
        </G>
        {/* galloping horse and rider */}
        <G fill="#2e2416">
          <Path d="M130 66c4-7 20-10 34-8 8 1 12 4 14 8 1 6-4 11-12 12-12 2-28 2-34-2-3-2-3-6-2-10z" />
          <Path d="M170 62l12-17 6-1 9 7-1 4-6-1-8 15z" />
          <Path d="M188 45l2-6 2 6z" />
          <Path d="M132 64c-8 0-14 4-18 11 6-2 10-4 16-5z" />
        </G>
        <G stroke="#2e2416" strokeWidth="3.6" strokeLinecap="round" fill="none">
          <Path d="M172 74l10 6 6 9" />
          <Path d="M166 76l4 10 9 6" />
          <Path d="M138 74l-10 6-6 8" />
          <Path d="M144 76l-2 10-8 6" />
        </G>
        <G fill="#2e2416">
          <Path d="M150 60l7-18 7 2-4 17z" />
          <Circle cx="162" cy="37.5" r="4.2" />
          <Path d="M157.5 35a4.6 4.6 0 0 1 9 0z" fill="#9b2b1f" />
          <Path d="M160 47l9 6-2 2-9-5z" />
        </G>
        {/* message tube on the saddle and the courier's pennant */}
        <Rect x="141" y="58" width="11" height="4.5" rx="2" fill="#c9a24e" stroke="#3a2a10" strokeWidth="0.8" />
        <Path d="M152 60L176 14" stroke="#3a2a10" strokeWidth="1.6" />
        <Path d="M175.5 15l15 4.5-15 5z" fill="#9b2b1f" />
        <Rect width="320" height="112" fill="url(#crHatch)" />
        <Rect width="320" height="112" fill="url(#crVig)" />
      </Svg>
    </Illus>
  );
});

const s = StyleSheet.create({
  illus: {
    marginTop: 10,
    marginHorizontal: 10,
    aspectRatio: 320 / 112,
    borderWidth: 2,
    borderColor: C.goldMid,
    boxShadow: SH.evIllus,
    overflow: 'hidden',
    backgroundColor: '#d4b273',
  },
});

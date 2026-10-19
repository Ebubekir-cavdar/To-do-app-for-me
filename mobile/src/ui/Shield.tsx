import { memo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { DAYS } from '../lib/dates';
import { F, TINCT, dimColor } from '../theme';

const SHIELD = 'M4 4h32v15c0 13-8 20-16 24C12 39 4 32 4 19z';

/** Heraldic day shield (final.html shieldSVG): weekday tincture, initial, crown for today. */
export const Shield = memo(function Shield({ index, today, past }: { index: number; today: boolean; past: boolean }) {
  const [c0, c1] = TINCT[index];
  const dim = (c: string) => (past ? dimColor(c) : c);
  const id = `shg${index}${past ? 'p' : ''}`;
  const letter = DAYS[index].charAt(0);
  return (
    <Svg width={36} height={50} viewBox="0 -9 40 57">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dim(c0)} />
          <Stop offset="1" stopColor={dim(c1)} />
        </LinearGradient>
      </Defs>
      {/* drop-shadow(0 2px 2px rgba(0,0,0,.6)) approximation */}
      <G transform="translate(0 2)">
        <Path d={SHIELD} fill="#000" fillOpacity={0.35} stroke="#000" strokeOpacity={0.3} strokeWidth={3} />
      </G>
      {today && (
        <>
          <Path d="M9 3.5L10.5-5l4.6 4.4L20-7.5l4.9 6.9L29.5-5 31 3.5z" fill="#f2cd6a" stroke="#3a2a10" strokeWidth={1} />
          <Circle cx="20" cy="-7.5" r="1.6" fill="#fff3c4" />
        </>
      )}
      <Path d={SHIELD} fill={`url(#${id})`} stroke={dim('#e8c873')} strokeWidth={2} />
      <Path d="M5 5h30v7H5z" fill="#fff" fillOpacity={0.13} />
      <Path d="M7.5 7.5h25v11.5c0 10.5-6.2 16.3-12.5 19.7C13.7 35.3 7.5 29.5 7.5 19z" fill="none" stroke="#000" strokeOpacity={0.35} />
      {/* paint-order: stroke — stroke pass first, fill pass on top */}
      <SvgText x="20" y="28" textAnchor="middle" fontFamily={F.head700} fontSize={17} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={1.6}>
        {letter}
      </SvgText>
      <SvgText x="20" y="28" textAnchor="middle" fontFamily={F.head700} fontSize={17} fill={dim('#fbeec4')}>
        {letter}
      </SvgText>
    </Svg>
  );
});

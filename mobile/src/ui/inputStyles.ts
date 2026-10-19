import { StyleSheet } from 'react-native';
import { C, F, SH } from '../theme';

/** .inp — parchment text field. */
export const inp = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 0,
    fontFamily: F.body500,
    fontSize: 17,
    color: C.ink,
    backgroundColor: 'rgba(255,250,232,0.62)',
    borderWidth: 1,
    borderColor: '#8a6f45',
    boxShadow: SH.inp,
    outlineStyle: 'solid',
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  focus: {
    outlineWidth: 2,
    outlineColor: C.goldMid,
    outlineOffset: 1,
    backgroundColor: 'rgba(255,252,240,0.9)',
  },
  err: { borderColor: C.red, boxShadow: SH.inpErr },
});

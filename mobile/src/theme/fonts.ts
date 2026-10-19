import { Cinzel_500Medium } from '@expo-google-fonts/cinzel/500Medium';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel/700Bold';
import { Alegreya_400Regular_Italic } from '@expo-google-fonts/alegreya/400Regular_Italic';
import { Alegreya_500Medium } from '@expo-google-fonts/alegreya/500Medium';
import { Alegreya_700Bold } from '@expo-google-fonts/alegreya/700Bold';
import { AlegreyaSC_500Medium } from '@expo-google-fonts/alegreya-sc/500Medium';
import { AlegreyaSC_700Bold } from '@expo-google-fonts/alegreya-sc/700Bold';

/**
 * Font assets for useFonts(). Each weight is its own family on React Native, so styles
 * pick a family name below instead of setting fontWeight / fontStyle. Only the faces the
 * UI references are loaded (the splash waits for all of them): add a face here and to `F`
 * together when a style needs it.
 */
export const fontAssets = {
  Cinzel_500Medium,
  Cinzel_700Bold,
  Alegreya_400Regular_Italic,
  Alegreya_500Medium,
  Alegreya_700Bold,
  AlegreyaSC_500Medium,
  AlegreyaSC_700Bold,
};

/** --f-head (Cinzel), --f-body (Alegreya), --f-sc (Alegreya SC). */
export const F = {
  head500: 'Cinzel_500Medium',
  head700: 'Cinzel_700Bold',
  body400i: 'Alegreya_400Regular_Italic',
  body500: 'Alegreya_500Medium',
  body700: 'Alegreya_700Bold',
  sc500: 'AlegreyaSC_500Medium',
  sc700: 'AlegreyaSC_700Bold',
} as const;

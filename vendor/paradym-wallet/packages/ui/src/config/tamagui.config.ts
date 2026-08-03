import { shorthands } from '@tamagui/shorthands'
import { radius, size, space, zIndex } from '@tamagui/themes'
import { type CreateTamaguiProps, createTamagui, createTokens } from 'tamagui'

import { animations } from '../animations'

import { fontInter, fontOpenSans, fontRaleway, fontRubik } from './font'

export { fontInter, fontOpenSans, fontRaleway, fontRubik }

export const absoluteFill = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
}

export const hexColors = {
  'grey-100': '#F8F8FA',
  'grey-200': '#F2F4F6',
  'grey-300': '#E0E3E8',
  'grey-400': '#C6CED5',
  'grey-500': '#9CA5AF',
  'grey-600': '#6D7581',
  'grey-700': '#2F3338',
  'grey-800': '#1E1E1E',
  'grey-900': '#111111',
  'primary-100': '#EEF0FE',
  'primary-200': '#DADEFF',
  'primary-300': '#ACB4FB',
  'primary-400': '#7A88FF',
  'primary-500': '#5A33F6',
  'primary-600': '#2233C9',
  'primary-700': '#202EA7',
  'primary-800': '#141E80',
  'primary-900': '#131C66',
  'feature-300': '#DBEAFE',
  'feature-400': '#60A5FA',
  'feature-500': '#3B82F6',
  'feature-600': '#1D4ED8',
  'feature-700': '#1E40AF',
  'positive-300': '#DCEEE2',
  'positive-400': '#8FC7A4',
  'positive-500': '#4D8F68', // Moss
  'positive-600': '#3A7355',
  'positive-700': '#2F5F45', // Forest
  'warning-300': '#FEF3C7',
  'warning-400': '#FCD34D',
  'warning-500': '#FBBF24',
  'warning-600': '#D97706',
  'warning-700': '#92400E',
  'danger-300': '#FEE2E2',
  'danger-400': '#F87171',
  'danger-500': '#DC3130',
  'danger-600': '#B8201F',
  'danger-700': '#991B1B',
  white: '#FFF',
  black: '#000',
  darkTranslucent: 'rgba(0,0,0,0.4)',
  lightTranslucent: 'rgba(255, 255, 255,  0.2)',
  borderTranslucent: 'rgba(224, 227, 232, 0.5)', // grey-300 with opacity
  // Named, rather than bare hex literals, for the two "invisible" spinner
  // track colors in Loader.tsx (raw RN `style` props, so these are consumed
  // as plain values, not `$token` strings).
  blackFaint: 'rgba(0,0,0,0.15)',
  blackNearZero: 'rgba(0,0,0,0.004)',
  overlayTint: 'rgba(0,0,0,0.10)',
}

export const tokensInput = {
  color: {
    ...hexColors,
    background: hexColors['grey-200'],
  },
  size: {
    ...size,
    buttonHeight: size.$4,
  },
  radius: {
    ...radius,
    button: 8,
  },
  zIndex,
  space,
} as const
export const tokens = createTokens(tokensInput)

export const configInput = {
  settings: {
    styleCompat: 'react-native',
    shouldAddPrefersColorThemes: true,
    addThemeClassName: 'body',
    // v2 defaults to 'static'; v1 effectively used 'relative'. Keeping 'relative'
    // preserves layout semantics for absolutely-positioned children (e.g. sheets,
    // sticky overlays) that assumed v1 behavior.
    defaultPosition: 'relative',
  },
  animations,
  shorthands,
  fonts: {
    // By default we use the same font for headings and body
    default: fontInter,
    heading: fontInter,
    // Somehow adding body font gives build errors?!
    body: fontInter,
  },
  tokens,
  themes: {
    light: {
      ...tokens.color,
      tableBackgroundColor: tokens.color.white,
      tableBorderColor: tokens.color['grey-200'],
    },
  },
  media: {
    short: {
      maxHeight: 756,
    },
  },
} as const satisfies CreateTamaguiProps

export const config = createTamagui(configInput)

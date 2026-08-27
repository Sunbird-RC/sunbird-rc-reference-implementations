import { radius, size, space, zIndex } from '@tamagui/themes'
import { createTamagui, createTokens } from 'tamagui'
import { configInput, fontRubik, hexColors } from '../../packages/ui/src/config/tamagui.config'
import { APP_THEME } from './src/config/themes'

const themeColors = APP_THEME

export const tokensInput = {
  color: hexColors,
  radius: {
    ...radius,
    button: 10,
    card: 14,
    tile: 20,
  },
  size,
  zIndex,
  space,
} as const

const tokens = createTokens({
  ...tokensInput,
  size: {
    ...tokensInput.size,
    buttonHeight: 56,
  },
  color: {
    ...hexColors, // Re-use existing colors for positive/warnings etc.
    background: '#FFFEF4', // Ivory — Sunbird Spark's mobile page background
    'grey-50': '#FAF9F3',
    'grey-100': '#F3F1E7',
    'grey-200': '#E7E3D3',
    'grey-300': '#D6D0BC',
    'grey-400': '#B8B096',
    'grey-500': '#8C8570',
    'grey-600': '#6B6656',
    'grey-700': '#4A4638',
    'grey-800': '#322F26',
    'grey-900': '#1F1D17',
    ...themeColors,
  },
})

const config = createTamagui({
  ...configInput,
  tokens,
  fonts: {
    // Rubik everywhere per the Sunbird Spark design system.
    default: fontRubik,
    heading: fontRubik,
    body: fontRubik,
  },
  themes: {
    light: {
      ...tokens.color,
      tableBackgroundColor: tokens.color['grey-50'],
      tableBorderColor: '#ffffff',
      idCardBackground: tokens.color['grey-100'],
    },
  },
})

type ConfIg = typeof config
declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TamaguiCustomConfig extends ConfIg {}
}

export default config

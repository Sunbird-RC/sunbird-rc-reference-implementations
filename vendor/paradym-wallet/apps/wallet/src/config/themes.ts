// Sunbird Spark brand: Brick (terracotta) primary, Wave/Ink (teal) as the
// secondary "feature" accent, plus the named joy/semantic colours the design
// system also expects to be available as tokens.
export const APP_THEME = {
  'primary-50': '#FBF1EC',
  'primary-100': '#F6E1D6',
  'primary-200': '#EBC3AD',
  'primary-300': '#DBA07E',
  'primary-400': '#C67856',
  'primary-500': '#A85236', // Brick
  'primary-600': '#8F4630', // Brick-shade — press/active
  'primary-700': '#74381F',
  'primary-800': '#5C2C18',
  'primary-900': '#3F1E10',
  'feature-300': '#D9EEF2',
  'feature-400': '#A8D4DE',
  'feature-500': '#70ADBF', // Wave
  'feature-600': '#4F8FA3',
  'feature-700': '#376673', // Ink
  ginger: '#CC8545', // hover shade for primary — warmer than Brick, not part of the ramp
  ink: '#376673',
  wave: '#70ADBF',
  sunflower: '#FFDB73',
  warmYellow: '#FFF1C7',
  lavender: '#7C6BAF',
  jamun: '#4A3A6B',
} satisfies Theme

export interface Theme {
  'primary-50': string
  'primary-100': string
  'primary-200': string
  'primary-300': string
  'primary-400': string
  'primary-500': string
  'primary-600': string
  'primary-700': string
  'primary-800': string
  'primary-900': string
  'feature-300': string
  'feature-400': string
  'feature-500': string
  'feature-600': string
  'feature-700': string
  ginger: string
  ink: string
  wave: string
  sunflower: string
  warmYellow: string
  lavender: string
  jamun: string
}

export type ThemeKey = keyof Theme

import { styled, Card as TCard } from 'tamagui'
import { shadows } from '../config/shadows'

export { Card, type CardProps } from 'tamagui'

// The Sunbird Spark card: white surface (page background is ivory), radius
// 14, soft symmetric glow, 20px inset. `Card` above stays a bare re-export
// because its compound API (`Card.Header`/`.Footer`/`.Background`, used by
// `CredentialCard`) isn't preserved by `styled()` — use `SparkCard` for new,
// non-compound card usage instead.
export const SparkCard = styled(TCard, {
  name: 'SparkCard',
  backgroundColor: '$white',
  borderRadius: '$card',
  padding: '$5',
  ...shadows.glow,
})

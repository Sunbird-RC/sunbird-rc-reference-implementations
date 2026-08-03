import { createAnimations } from '@tamagui/animations-react-native'
import { type ComplexAnimationBuilder, Easing, FadeInUp } from 'react-native-reanimated'

// Sunbird Spark motion: gentle and quick, no bounce, no infinite loops.
export const MOTION_EASE = Easing.bezier(0.4, 0, 0.2, 1)
export const MOTION_DURATION = {
  interaction: 200,
  card: 300,
  progress: 500,
} as const

// Shared entrance for cards/lists — a plain fade-up on the `card` duration,
// deliberately not a spring (the design system calls for a soft fade-in-up,
// not a bounce).
export const fadeInUp = (delay = 0) => FadeInUp.duration(MOTION_DURATION.card).easing(MOTION_EASE).delay(delay)

export const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  normal: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  lazy: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
    delay: 2,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
})

export const springConfig = {
  damping: 24,
  mass: 0.8,
  stiffness: 200,
  restSpeedThreshold: 0.05,
}

export const useSpringify = <T extends ComplexAnimationBuilder>(AnimationClass: new () => T, delay = 0): T => {
  const animation = new AnimationClass()
  return animation
    .springify()
    .damping(springConfig.damping)
    .mass(springConfig.mass)
    .stiffness(springConfig.stiffness)
    .restSpeedThreshold(springConfig.restSpeedThreshold)
    .delay(delay) as T
}

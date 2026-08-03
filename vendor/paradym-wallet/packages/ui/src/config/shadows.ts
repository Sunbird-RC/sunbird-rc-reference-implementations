// Soft, warm, low-contrast shadows per the Sunbird Spark design system.
// Shared between `base/Stacks.tsx`'s `shadow` variant and `panels/Card.tsx`,
// which can't use that variant directly (it styles tamagui's own `Card`, not
// our `Stack`).
export const shadows = {
  sm: {
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  md: {
    elevation: 6,
    shadowOffset: { width: 0, height: 14 },
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
  },
  lg: {
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  glow: {
    elevation: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
} as const

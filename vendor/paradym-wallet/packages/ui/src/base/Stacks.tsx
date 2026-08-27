import Animated from 'react-native-reanimated'
import { ScrollView, type ScrollViewProps, styled, View as TStack, type ViewProps } from 'tamagui'
import { shadows } from '../config/shadows'

export const Stack = styled(TStack, {
  name: 'Stack',
  variants: {
    'flex-1': {
      true: {
        flex: 1,
      },
    },
    // Soft, warm, low-contrast shadows per the Sunbird Spark design system.
    // `true` defaults to `glow` — the symmetric shadow the spec calls for on
    // mobile cards — so existing `shadow` (boolean) call sites keep working.
    shadow: {
      sm: shadows.sm,
      md: shadows.md,
      lg: shadows.lg,
      glow: shadows.glow,
      true: shadows.glow,
    },
    bordered: {
      true: {
        borderWidth: 0.5,
        borderColor: '$grey-300',
      },
    },
    borderRad: {
      xs: {
        borderRadius: '$1',
      },
      sm: {
        borderRadius: '$2',
      },
      md: {
        borderRadius: '$3',
      },
      lg: {
        borderRadius: '$4',
      },
      xl: {
        borderRadius: '$8',
      },
    },
    g: {
      xs: {
        gap: '$1',
      },
      sm: {
        gap: '$2',
      },
      md: {
        gap: '$3',
      },
      lg: {
        gap: '$4',
      },
      xl: {
        gap: '$6',
      },
      '2xl': {
        gap: '$8',
      },
      '3xl': {
        gap: '$10',
      },
      '4xl': {
        gap: '$12',
      },
    },
    pad: {
      xs: {
        padding: '$1',
      },
      sm: {
        padding: '$2',
      },
      md: {
        padding: '$3',
      },
      lg: {
        padding: '$4',
      },
      xl: {
        padding: '$6',
      },
    },
  } as const,
})

export const XStack = styled(Stack, {
  flexDirection: 'row',
})

export const YStack = styled(Stack, {
  flexDirection: 'column',
})

export const ZStack = styled(
  YStack,
  {
    flexDirection: 'column',
    position: 'relative',
  },
  {
    neverFlatten: true,
    isZStack: true,
  }
)

interface ScrollableStackProps extends ViewProps {
  layout?: 'x' | 'y' | 'z'
  scrollViewProps?: ScrollViewProps
  ref?: React.Ref<ScrollView>
  children?: React.ReactNode
}

export const ScrollableStack = ({ layout, scrollViewProps, children, ref, ...props }: ScrollableStackProps) => {
  const AlignedStack = layout === 'x' ? XStack : layout === 'y' ? YStack : layout === 'z' ? ZStack : Stack

  return (
    <ScrollView ref={ref} w={scrollViewProps?.w ?? '100%'} alwaysBounceVertical={false} {...scrollViewProps}>
      <AlignedStack {...props}>{children}</AlignedStack>
    </ScrollView>
  )
}

export const AnimatedStack = Animated.createAnimatedComponent(Stack)

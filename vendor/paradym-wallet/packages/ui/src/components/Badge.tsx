import type { ReactNode } from 'react'
import { Paragraph } from '../base/Paragraph'
import { XStack } from '../base/Stacks'

interface BadgeProps {
  label: string
  icon?: ReactNode
  /**
   * `warm` (default) is the design system's content-type label: amber-cream
   * fill with a warm border. `primary` is a stronger Brick-tinted pill for
   * active/selected states.
   */
  variant?: 'warm' | 'primary'
}

// Tinted pill badge, per the Sunbird Spark design system's content-type label.
export function Badge({ label, icon, variant = 'warm' }: BadgeProps) {
  const bg = variant === 'warm' ? '$warmYellow' : '$primary-100'
  const color = variant === 'warm' ? '$primary-700' : '$primary-600'

  return (
    <XStack ai="center" gap="$1.5" bg={bg} bw="$0.5" borderColor="$primary-200" br="$12" px="$2.5" py="$1">
      {icon}
      <Paragraph size="$1" fontWeight="$semiBold" color={color}>
        {label}
      </Paragraph>
    </XStack>
  )
}

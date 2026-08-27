import { credentialIssuerUrls } from '@app/constants'
import { useLingui } from '@lingui/react/macro'
import { useHaptics } from '@package/app'
import { Circle, Heading, HeroIcons, LucideIcons, Paragraph, SparkCard, XStack, YStack } from '@package/ui'
import { useRouter } from 'expo-router'

export function GetCardCard() {
  const { push } = useRouter()
  const { withHaptics } = useHaptics()
  const { t } = useLingui()

  if (credentialIssuerUrls.length === 0) return null

  return (
    <SparkCard onPress={withHaptics(() => push('/issuers'))} pressStyle={{ opacity: 0.9 }}>
      <XStack ai="center" gap="$4">
        <Circle size="$5" bg="$warmYellow">
          <LucideIcons.BookOpen size={22} color="$primary-700" />
        </Circle>
        <YStack fg={1} f={1} gap="$1">
          <Heading heading="sub1" numberOfLines={1}>
            {t({
              id: 'issuers.homeTitle',
              message: 'Get a card',
              comment: 'Title of the home screen button that opens the issuer directory',
            })}
          </Heading>
          <Paragraph size="$2" numberOfLines={1}>
            {t({
              id: 'issuers.homeDescription',
              message: 'Browse available issuers',
              comment: 'Subtext of the home screen button that opens the issuer directory',
            })}
          </Paragraph>
        </YStack>
        <HeroIcons.ChevronRight size={20} color="$grey-500" />
      </XStack>
    </SparkCard>
  )
}

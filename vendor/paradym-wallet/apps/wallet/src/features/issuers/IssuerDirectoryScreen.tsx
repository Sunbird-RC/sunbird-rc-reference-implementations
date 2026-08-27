import { Trans, useLingui } from '@lingui/react/macro'
import { TextBackButton, useHaptics, useScrollViewPosition } from '@package/app'
import {
  AnimatedStack,
  Circle,
  FlexPage,
  fadeInUp,
  HeaderContainer,
  Heading,
  HeroIcons,
  Image,
  InfoButton,
  Loader,
  Paragraph,
  ScrollView,
  Spacer,
  XStack,
  YStack,
} from '@package/ui'
import { useRouter } from 'expo-router'
import { buildCredentialOfferUri, type IssuerDirectoryIssuer, useCredentialIssuers } from './useCredentialIssuers'

export function IssuerDirectoryScreen() {
  const { t } = useLingui()
  const { push } = useRouter()
  const { withHaptics } = useHaptics()
  const { handleScroll, isScrolledByOffset, scrollEventThrottle } = useScrollViewPosition()
  const { issuers, isLoading } = useCredentialIssuers()

  const startIssuance = withHaptics((issuer: IssuerDirectoryIssuer, configurationId: string) => {
    const offerUri = buildCredentialOfferUri(issuer, configurationId)
    push(`/notifications/openIdCredential?uri=${encodeURIComponent(offerUri)}`)
  })

  const hasCredentials = issuers.some((issuer) => issuer.credentials.length > 0)

  return (
    <FlexPage gap="$0" paddingHorizontal="$0">
      <HeaderContainer
        title={t({
          id: 'issuers.title',
          message: 'Get a card',
          comment: 'Heading for the list of issuers the user can request a credential from',
        })}
        isScrolledByOffset={isScrolledByOffset}
      />

      {isLoading ? (
        <YStack fg={1} ai="center" jc="center">
          <Loader />
          <Spacer size="$12" />
        </YStack>
      ) : !hasCredentials ? (
        <AnimatedStack flexDirection="column" entering={fadeInUp(150)} gap="$2" jc="center" p="$4" fg={1}>
          <Heading ta="center" heading="h3" fontWeight="$semiBold">
            <Trans id="issuers.emptyTitle" comment="Shown when no issuers could be loaded">
              No issuers available
            </Trans>
          </Heading>
          <Paragraph ta="center" px="$2">
            <Trans id="issuers.emptyDescription" comment="Subtext explaining why the issuer list is empty">
              We couldn't reach any issuers right now. You can still receive a card by scanning a QR-code.
            </Trans>
          </Paragraph>
        </AnimatedStack>
      ) : (
        <ScrollView px="$4" onScroll={handleScroll} scrollEventThrottle={scrollEventThrottle}>
          <YStack gap="$5" pb="$4">
            {issuers
              .filter((issuer) => issuer.credentials.length > 0)
              .map((issuer) => (
                <AnimatedStack key={issuer.credentialIssuer} entering={fadeInUp()} flexDirection="column" gap="$3">
                  <XStack ai="center" gap="$3">
                    <Circle size="$4" bg="$grey-100">
                      {issuer.logoUri ? (
                        <Image src={issuer.logoUri} width={22} height={22} />
                      ) : (
                        <HeroIcons.BuildingOffice size={20} color="$grey-700" />
                      )}
                    </Circle>
                    <Heading heading="sub1" numberOfLines={1} fg={1} f={1}>
                      {issuer.name}
                    </Heading>
                  </XStack>
                  <YStack gap="$2">
                    {issuer.credentials.map((credential) => (
                      <InfoButton
                        key={credential.configurationId}
                        noIcon
                        title={credential.name}
                        description={credential.description}
                        badge={credential.format ? { label: credential.format } : undefined}
                        onPress={() => startIssuance(issuer, credential.configurationId)}
                      />
                    ))}
                  </YStack>
                </AnimatedStack>
              ))}
          </YStack>
        </ScrollView>
      )}

      <YStack btw="$0.5" borderColor="$grey-200" pt="$4" mx="$-4" px="$4" bg="$background">
        <TextBackButton />
      </YStack>
    </FlexPage>
  )
}

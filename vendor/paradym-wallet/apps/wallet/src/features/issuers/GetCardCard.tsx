import { credentialIssuerUrls } from '@app/constants'
import { useLingui } from '@lingui/react/macro'
import { useHaptics } from '@package/app'
import { InfoButton } from '@package/ui'
import { useRouter } from 'expo-router'

export function GetCardCard() {
  const { push } = useRouter()
  const { withHaptics } = useHaptics()
  const { t } = useLingui()

  if (credentialIssuerUrls.length === 0) return null

  return (
    <InfoButton
      noIcon
      title={t({
        id: 'issuers.homeTitle',
        message: 'Get a card',
        comment: 'Title of the home screen button that opens the issuer directory',
      })}
      description={t({
        id: 'issuers.homeDescription',
        message: 'Browse available issuers',
        comment: 'Subtext of the home screen button that opens the issuer directory',
      })}
      onPress={withHaptics(() => push('/issuers'))}
    />
  )
}

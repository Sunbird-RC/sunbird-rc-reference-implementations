import { defineMessage } from '@lingui/core/macro'
import { useAssets } from 'expo-asset'

export const copy = {
  about: {
    description: defineMessage({
      id: 'paradymWallet.about.description',
      message:
        'This app was created by Animo Solutions as a companion app for Sunbird Wallet. All code is available under Apache 2.0.',
      comment: 'About screen description text for the Sunbird wallet',
    }),
    emailHeader: defineMessage({
      id: 'paradymWallet.about.emailHeader',
      message: 'Reach out from Sunbird Wallet',
      comment: 'Email subject when contacting support from Sunbird wallet',
    }),
  },
}

export function useAppCopy() {
  return copy
}

export function useAppIcon() {
  const [assets] = useAssets([require('../../assets/paradym/icon.png')])
  return assets?.[0]
}

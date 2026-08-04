import { useLingui } from '@lingui/react/macro'
import { commonMessages } from '@package/translations'
import { Button, Spinner, YStack } from '@package/ui'
import { useState } from 'react'
import { Input } from 'tamagui'

export interface OnboardingNameProps {
  goToNextStep: (name: string) => Promise<void>
}

export function OnboardingName({ goToNextStep }: OnboardingNameProps) {
  const { t } = useLingui()
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const onContinue = () => {
    if (isLoading || name.trim().length === 0) return

    setIsLoading(true)
    goToNextStep(name.trim()).finally(() => setIsLoading(false))
  }

  return (
    <YStack fg={1} jc="space-between" gap="$6">
      <YStack mt="$10">
        <Input
          autoFocus
          value={name}
          onChangeText={setName}
          onSubmitEditing={onContinue}
          returnKeyType="done"
          placeholder={t({ id: 'onboarding.name.placeholder', message: 'Your name' })}
          placeholderTextColor="$grey-500"
          borderColor="$grey-300"
          size="$4"
        />
      </YStack>
      <Button.Solid scaleOnPress disabled={isLoading || name.trim().length === 0} onPress={onContinue}>
        {isLoading ? <Spinner variant="dark" /> : t(commonMessages.continue)}
      </Button.Solid>
    </YStack>
  )
}

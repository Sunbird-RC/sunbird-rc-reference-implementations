import type { ParadymWalletSdk } from '../../ParadymWalletSdk'
import { storeSharedActivityForCredentialsForRequest } from '../../storage/activityStore'
import type { CredentialsForProofRequest } from '../func/resolveCredentialRequest'
import { getFormattedTransactionData } from '../transaction'

export type DeclineCredentialRequestOptions = {
  paradym: ParadymWalletSdk
  resolvedRequest: CredentialsForProofRequest
}

/**
 * Tells the verifier the holder said no.
 *
 * Without this the decline is purely local: the wallet records an activity and
 * navigates away, and the verifier learns nothing at all. It cannot then
 * distinguish a refusal from a request the holder ignored, so its only terminal
 * signal is the request expiring — which in practice means a spinner in front of
 * whoever is waiting, and a verifier UI that has to offer its own "give up"
 * button for something the holder already decided.
 *
 * OpenID4VP allows exactly this: for direct_post, an Authorization Error
 * Response posted to `response_uri` with `error=access_denied`
 * (RFC 6749 §4.1.2.1, carried into OpenID4VP's response modes).
 *
 * Best effort by design. If the post fails, the holder's refusal still stands
 * locally — the presentation is not sent either way, and no error here should
 * ever block the decline.
 */
const notifyVerifierOfRefusal = async (resolvedRequest: CredentialsForProofRequest, paradym: ParadymWalletSdk) => {
  const request = resolvedRequest.authorizationRequest as Record<string, unknown> | undefined
  const responseUri = request?.response_uri ?? request?.redirect_uri
  const state = request?.state
  const responseMode = String(request?.response_mode ?? '')

  // Only direct_post has somewhere to post to. Other response modes hand the
  // response back through the browser, where there is nothing to notify.
  if (typeof responseUri !== 'string' || !responseMode.startsWith('direct_post')) return

  try {
    const body = new URLSearchParams({
      error: 'access_denied',
      error_description: 'The holder declined the request',
    })
    if (typeof state === 'string') body.append('state', state)

    await fetch(responseUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (error) {
    paradym.logger.debug('Could not notify the verifier of the refusal', { error })
  }
}

export const declineCredentialRequest = async ({ resolvedRequest, paradym }: DeclineCredentialRequestOptions) => {
  await notifyVerifierOfRefusal(resolvedRequest, paradym)

  const formattedTransactionData = getFormattedTransactionData(resolvedRequest)
  await storeSharedActivityForCredentialsForRequest(
    paradym,
    resolvedRequest,
    resolvedRequest.formattedSubmission.areAllSatisfied ? 'stopped' : 'failed',
    formattedTransactionData
  )
}

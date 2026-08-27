import type { JwsSignerDid } from '@credo-ts/core'
import type { OpenId4VciResolvedCredentialOffer, OpenId4VpResolvedAuthorizationRequest } from '@credo-ts/openid4vc'
import type {
  DidTrustMechanismConfiguration,
  TrustedEntity,
  TrustedIssuerEntity,
  TrustedRelyingPartyEntity,
} from '../trustMechanism'

export type TrustedDidEntity = {
  did: string
  name: string
  logoUri: string
  url: string
  demo?: boolean
  entityId: string
}

export type GetTrustedEntitiesForDidForOpenId4VpOptions = {
  resolvedAuthorizationRequest: OpenId4VpResolvedAuthorizationRequest
  trustMechanismConfiguration: DidTrustMechanismConfiguration
  walletTrustedEntity?: TrustedEntity
}

export type GetTrustedEntitiesForDidForOpenId4VciOptions = {
  resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
  trustMechanismConfiguration: DidTrustMechanismConfiguration
  walletTrustedEntity?: TrustedEntity
}

export const getTrustedEntitiesForDidForOpenId4Vp = async (
  options: GetTrustedEntitiesForDidForOpenId4VpOptions
): Promise<TrustedRelyingPartyEntity> => {
  const clientMetadata = options.resolvedAuthorizationRequest.authorizationRequestPayload.client_metadata
  const effectiveClientId = options.resolvedAuthorizationRequest.verifier.effectiveClientId
  const trustedEntities: TrustedEntity[] = []

  // Normalise the client id before matching it against the configured entities.
  //
  // `effectiveClientId` is the `client_id` verbatim, so it only carries the
  // `decentralized_identifier:` prefix when the verifier actually sent one.
  // OpenID4VP before draft 26 uses the bare `did:` form, which the library still
  // resolves to this trust mechanism (`did` maps to the `decentralized_identifier`
  // uniform prefix), so comparing against the prefixed string alone can never
  // match such a verifier and no configured entity would ever be found.
  //
  // Strip the prefix and any key fragment, then prefix-match, as the OpenID4VCI
  // path below already does — that also lets one configured entity cover every
  // DID issued under a host.
  const baseDid = effectiveClientId?.replace(/^decentralized_identifier:/, '').split('#')[0]
  const matchedDid = baseDid
    ? options.trustMechanismConfiguration.trustedDidEntities.find((e) => baseDid.startsWith(e.did))
    : undefined

  // Prefer metadata from the request over the hardcoded entity data
  const organizationName = clientMetadata?.client_name ?? matchedDid?.name
  const logoUri = clientMetadata?.logo_uri ?? matchedDid?.logoUri

  if (matchedDid) {
    trustedEntities.push({
      entityId: matchedDid.entityId,
      organizationName: matchedDid.name,
      logoUri: matchedDid.logoUri,
      uri: matchedDid.url,
      demo: matchedDid.demo,
    })

    if (options.walletTrustedEntity) trustedEntities.push(options.walletTrustedEntity)
  }

  return {
    relyingParty: {
      organizationName,
      logoUri,
      entityId: baseDid,
    },
    trustedEntities,
  }
}

export const getTrustedEntitiesForDidForOpenId4Vci = (
  options: GetTrustedEntitiesForDidForOpenId4VciOptions
): TrustedIssuerEntity | undefined => {
  // Checked in the caller
  const signer = options.resolvedCredentialOffer.metadata.signedCredentialIssuer?.signer as JwsSignerDid
  // Strip fragment to get base DID (e.g. did:web:example.com#key-1 -> did:web:example.com)
  const baseDid = signer.didUrl.split('#')[0]
  const trustedEntity = options.trustMechanismConfiguration.trustedDidEntities.find((e) => baseDid.startsWith(e.did))
  if (trustedEntity) {
    // Prefer display data from the signed metadata over the hardcoded entity
    const metadataDisplay = options.resolvedCredentialOffer.metadata.signedCredentialIssuer?.jwt.payload.display?.[0]
    const organizationName = metadataDisplay?.name ?? trustedEntity.name
    const logoUri = metadataDisplay?.logo?.uri ?? trustedEntity.logoUri

    const trustedEntities: TrustedEntity[] = [
      {
        entityId: trustedEntity.entityId,
        organizationName,
        logoUri,
        uri: trustedEntity.url,
        demo: trustedEntity.demo,
      },
    ]
    if (options.walletTrustedEntity) trustedEntities.push(options.walletTrustedEntity)

    return {
      issuer: {
        organizationName,
        logoUri,
        uri: trustedEntity.url,
        entityId: trustedEntity.entityId,
      },
      trustedEntities,
    }
  }
}

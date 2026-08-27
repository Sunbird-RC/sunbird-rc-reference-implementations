import { credentialIssuerUrls } from '@app/constants'
import { useQuery } from '@tanstack/react-query'

export interface IssuerDirectoryCredential {
  configurationId: string
  name: string
  description?: string
  format?: string
  logoUri?: string
}

export interface IssuerDirectoryIssuer {
  credentialIssuer: string
  name: string
  logoUri?: string
  // Only set when the issuer metadata lists more than one authorization server.
  // In that case the offer we create MUST point at one of them explicitly.
  authorizationServer?: string
  credentials: IssuerDirectoryCredential[]
}

interface OpenId4VciDisplay {
  name?: string
  description?: string
  logo?: { uri?: string; url?: string }
}

interface OpenId4VciIssuerMetadata {
  credential_issuer?: string
  authorization_servers?: string[]
  display?: OpenId4VciDisplay[]
  // `credentials_supported` is the draft-13 name for
  // `credential_configurations_supported`. Sunbird RC emits it when
  // DRAFT13_COMPAT_MODE is on, so accept both.
  credential_configurations_supported?: Record<string, Record<string, unknown>>
  credentials_supported?: Record<string, Record<string, unknown>>
}

function getDisplay(display: OpenId4VciDisplay[] | undefined) {
  const entry = display?.[0]
  return { name: entry?.name, description: entry?.description, logoUri: entry?.logo?.uri ?? entry?.logo?.url }
}

async function fetchIssuer(issuerUrl: string): Promise<IssuerDirectoryIssuer> {
  const metadataUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-credential-issuer`
  const response = await fetch(metadataUrl, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Could not fetch issuer metadata from ${metadataUrl} (${response.status})`)

  const metadata = (await response.json()) as OpenId4VciIssuerMetadata
  const configurations = metadata.credential_configurations_supported ?? metadata.credentials_supported ?? {}
  const issuerDisplay = getDisplay(metadata.display)

  const credentials = Object.entries(configurations).map(([configurationId, configuration]) => {
    const credentialDisplay = getDisplay(configuration.display as OpenId4VciDisplay[] | undefined)
    return {
      configurationId,
      // Fall back to the scope, which issuers commonly set to the credential
      // type name, and finally to the raw configuration id.
      name: credentialDisplay.name ?? (configuration.scope as string | undefined) ?? configurationId,
      description: credentialDisplay.description,
      format: configuration.format as string | undefined,
      logoUri: credentialDisplay.logoUri,
    }
  })

  return {
    credentialIssuer: metadata.credential_issuer ?? issuerUrl,
    name: issuerDisplay.name ?? new URL(issuerUrl).host,
    logoUri: issuerDisplay.logoUri,
    // The façade itself is always listed as an AS (for pre-authorized_code);
    // when there's a second one (e.g. Keycloak, for authorization_code) it must
    // be referenced explicitly in the offer, since the wallet has no other way
    // to know which of the listed servers actually issues authorization codes.
    authorizationServer: metadata.authorization_servers?.find(
      (server) => server !== (metadata.credential_issuer ?? issuerUrl)
    ),
    credentials,
  }
}

/**
 * Fetches the issuer metadata of every configured credential issuer. Issuers
 * that can't be reached are omitted rather than failing the whole directory.
 */
export function useCredentialIssuers() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['credentialIssuerDirectory', credentialIssuerUrls],
    queryFn: async () => {
      const results = await Promise.allSettled(credentialIssuerUrls.map(fetchIssuer))
      return {
        issuers: results.filter((result) => result.status === 'fulfilled').map((result) => result.value),
        failedCount: results.filter((result) => result.status === 'rejected').length,
      }
    },
    enabled: credentialIssuerUrls.length > 0,
  })

  return {
    issuers: data?.issuers ?? [],
    failedCount: data?.failedCount ?? 0,
    isLoading,
    isRefetching,
    refetch,
  }
}

/**
 * Builds a wallet-initiated credential offer for a credential configuration.
 * The authorization code grant is used, so the user authenticates at the
 * issuer's authorization server (e.g. Keycloak) before the credential is issued.
 */
export function buildCredentialOfferUri(issuer: IssuerDirectoryIssuer, configurationId: string) {
  const credentialOffer = {
    credential_issuer: issuer.credentialIssuer,
    credential_configuration_ids: [configurationId],
    grants: {
      authorization_code: issuer.authorizationServer ? { authorization_server: issuer.authorizationServer } : {},
    },
  }

  return `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(credentialOffer))}`
}

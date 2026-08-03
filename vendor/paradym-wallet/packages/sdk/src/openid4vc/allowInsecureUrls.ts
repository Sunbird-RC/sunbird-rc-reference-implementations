import { setGlobalConfig } from '@openid4vc/utils'

/**
 * Relaxes the OID4VCI/OID4VP libraries' https-only URL validation, so a
 * non-TLS local issuer (e.g. a docker-compose stack on the LAN) can be used
 * during development. Never call this outside of a dev build — production
 * issuers must be served over https.
 */
export function allowInsecureOpenId4VcUrlsForDevelopment() {
  setGlobalConfig({ allowInsecureUrls: true })
}

# Deployment and demo guide

The three applications run on one Docker Compose stack and share common Sunbird
RC services while retaining separate Registry entities, issuers, identity realms
and verifier policies.

## Prerequisites

- Docker with Compose
- Node.js 22 or later
- A fixed public HTTPS hostname when a physical mobile wallet is used

## Start the stack

```bash
cd deploy
cp env.example .env
docker compose up -d
../scripts/bootstrap.sh
../scripts/seed-age-citizens.sh
../scripts/seed-agriculture.sh
../scripts/seed-education.sh
cd ..
npm install
```

For a mobile device, configure the public HTTPS origin before bootstrapping or
issuing credentials. See `scripts/enable-https.sh` and `deploy/env.example`.

## Open the applications

| Application | Verifier |
|---|---|
| Age verification | `/verifier/` |
| Agriculture and rural credit | `/bank/` |
| Master's eligibility | `/admissions/` |
| Employment eligibility | `/employer/` |

Issuance is initiated from the customized Paradym mobile wallet. Build it with
`scripts/build-wallet.sh`, supplying only the issuers required for the selected
application. The command-line wallet scripts can be used for repeatable local
evaluation, but the intended demonstration uses the mobile wallet.

## Reset and repeat

The seed scripts are deterministic and safe to rerun against the demonstration
environment. Do not use the bundled synthetic identities, credentials, keys or
policies in production.

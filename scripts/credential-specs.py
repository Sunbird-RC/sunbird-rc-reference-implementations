#!/usr/bin/env python3
"""Credential schema specs for scripts/bootstrap.sh.

A file rather than heredocs inside bootstrap.sh: three credentials with real
claim descriptions is more text than a shell script can carry legibly, and
bash 3.2 (still the default on macOS) cannot parse a heredoc inside $(...) in a
function body at all.

Usage: credential-specs.py <age|farmer|land> <author-did> <vct-slug>
Prints one JSON spec for scripts/bootstrap.sh's create_schema.
"""
import json
import sys

SPECS = {
    "age": {
        "name": "Age Verification Credential",
        "id": "AgeVerificationCredential",
        "tags": ["age"],
        "description": (
            "Issuer-derived age assertions. ageOver18/ageOver21 are computed by the issuer "
            "from the authoritative AgeCitizen date of birth; name and dateOfBirth travel as "
            "selectively-disclosable claims the holder is expected NOT to reveal to an "
            "age-restricted service."
        ),
        "properties": {
            "ageOver18": {"type": "boolean", "description": "Derived at issuance from dateOfBirth."},
            "ageOver21": {"type": "boolean", "description": "Derived at issuance from dateOfBirth."},
            "name": {"type": "string"},
            "dateOfBirth": {"type": "string", "format": "date"},
        },
        "required": ["ageOver18"],
    },
    "farmer": {
        "name": "Farmer Identity Credential",
        "id": "FarmerIdentityCredential",
        "tags": ["agriculture"],
        "description": (
            "Identity of a registered farmer, from the Farmer Registry's authoritative record. "
            "farmerId is the Agriculture correlation identifier a lender matches against the "
            "Land credential. nationalId is deliberately ABSENT: it is the issuer's lookup key "
            "and must never reach a verifier. farmerCategory and district travel as "
            "selectively-disclosable claims a bank does not request."
        ),
        "properties": {
            "farmerId": {
                "type": "string",
                "description": "Agriculture correlation identifier, e.g. FRM-KA-0041.",
            },
            "registeredFarmer": {
                "type": "boolean",
                "description": "Whether the registry lists this person as a registered farmer.",
            },
            "farmerCategory": {"type": "string", "description": "Landholding category."},
            "district": {"type": "string"},
        },
        "required": ["farmerId", "registeredFarmer"],
    },
    "land": {
        "name": "Land Ownership Credential",
        "id": "LandOwnershipCredential",
        "tags": ["agriculture"],
        "description": (
            "Ownership and cultivation of one land parcel, from the Land Registry's "
            "authoritative record. farmerId is carried so a lender can correlate this "
            "credential with the Farmer credential; cropType and cultivatedAreaAcres are the "
            "verified inputs to a crop-based loan calculation. nationalId is deliberately "
            "ABSENT. landId, landAreaAcres and district travel as selectively-disclosable "
            "claims a bank does not request: the loan uses cultivated area only, so total "
            "holding size stays with the farmer."
        ),
        "properties": {
            "landId": {"type": "string", "description": "Land parcel identifier, e.g. LAND-MYS-820137."},
            "farmerId": {"type": "string", "description": "The owning farmer, for correlation."},
            "ownershipStatus": {
                "type": "string",
                "description": "ACTIVE, INACTIVE, DISPUTED or TRANSFERRED. Only ACTIVE is fundable.",
            },
            "landAreaAcres": {"type": "number", "description": "Total parcel area."},
            "cropType": {"type": "string", "description": "Controlled vocabulary; the rate is looked up from policy."},
            "cultivatedAreaAcres": {
                "type": "number",
                "description": "The authoritative input to the loan calculation, at most two decimals.",
            },
            "district": {"type": "string"},
        },
        "required": ["landId", "farmerId", "ownershipStatus", "cropType", "cultivatedAreaAcres"],
    },
}


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    which, author, vct = sys.argv[1:4]
    spec = SPECS.get(which)
    if spec is None:
        print(f"unknown credential '{which}'; expected one of {', '.join(SPECS)}", file=sys.stderr)
        return 2
    if not author.startswith("did:"):
        print(f"author must be a DID, got '{author}'", file=sys.stderr)
        return 2
    print(json.dumps({**spec, "author": author, "vct": vct}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

// Agriculture domain module.
//
// The whole Agriculture-specific surface of the verifier: which claims the bank
// asks for from which credential, and what a verified pair of credentials means
// for farm credit. Everything else in services/verifier stays generic.
//
// It receives only verified, allowlisted, minimum-disclosure claims from
// credentials already proven to be signed by the right issuer for their role and
// bound to the same holder. It never sees a raw presentation, an undisclosed
// claim, National ID, or an unverified credential.
//
// The distinction this module exists to keep straight: a *verification* problem
// (correlation broken, a claim that is not what the schema promised) is
// REJECTED / UNABLE TO VERIFY, while a *business* answer (not registered, no
// active ownership, nothing cultivated, a crop this policy does not lend
// against) is NOT ELIGIBLE. PRODUCT is explicit that the first must never be
// dressed up as the second.

import { readFileSync } from 'node:fs';
import { acresToHundredths, hundredthsToAcres, maximumLoan } from './money.mjs';

/** DCQL query ids. These key the claims in the multi-credential VP response. */
export const FARMER_REQUEST_ID = 'farmer_cred';
export const LAND_REQUEST_ID = 'land_cred';

/**
 * Minimum disclosure, per REQUIREMENTS §5. Read the two lists together: the bank
 * gets `farmerId` twice — once from each credential, which is the whole point,
 * since correlation is only meaningful if both credentials say it — plus one
 * registration flag and the three fields the loan is computed from.
 *
 * Everything else both credentials carry (National ID never leaves the issuer;
 * name, district, farmer category, land id, total land area) is deliberately not
 * requested, which is what makes the selective disclosure demonstrable.
 */
export const FARMER_CLAIMS = ['farmerId', 'registeredFarmer'];
export const LAND_CLAIMS = ['farmerId', 'ownershipStatus', 'cropType', 'cultivatedAreaAcres'];

/** The ownership vocabulary the Land Registry schema permits. */
const OWNERSHIP_STATUSES = ['ACTIVE', 'INACTIVE', 'DISPUTED', 'TRANSFERRED'];

/**
 * The two credential requests, in the order the bank presents them.
 *
 * Each names the credential type it will accept and the role it must satisfy;
 * the generic verifier pins the trusted issuer per role, so a Farmer credential
 * cannot arrive in the Land slot even when both issuers are trusted
 * (REQUIREMENTS §8).
 *
 * @param {{farmerVct: string, landVct: string}} config
 */
export function agricultureCredentialRequests({ farmerVct, landVct }) {
  if (!farmerVct || !landVct) throw new Error('both farmerVct and landVct are required');
  return [
    { id: FARMER_REQUEST_ID, vct: farmerVct, claims: FARMER_CLAIMS, role: 'farmer' },
    { id: LAND_REQUEST_ID, vct: landVct, claims: LAND_CLAIMS, role: 'land' },
  ];
}

/**
 * Loads and validates the version-controlled lending policy.
 *
 * Validation is deliberately strict at load time, in the spirit of the trust
 * allowlist: a malformed policy should stop the service starting rather than
 * quietly produce a wrong rupee figure in front of an audience.
 *
 * @param {{file: string}} config
 */
export function loadCropPolicy({ file }) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const cap = raw.maxRatePerAcre;
  const rates = raw.rates || {};

  if (!Number.isInteger(cap) || cap <= 0) {
    throw new Error(`crop policy ${file} has no usable maxRatePerAcre`);
  }
  const crops = Object.keys(rates);
  if (crops.length === 0) throw new Error(`crop policy ${file} lists no crop rates`);

  for (const [crop, rate] of Object.entries(rates)) {
    if (!Number.isInteger(rate) || rate <= 0) {
      throw new Error(`crop policy ${file}: ${crop} has a non-positive or fractional rate (${rate})`);
    }
    if (rate > cap) {
      // PRODUCT sets ₹50,000/acre as the demo ceiling. Exceeding it silently
      // would overstate every loan for that crop.
      throw new Error(`crop policy ${file}: ${crop} rate ${rate} exceeds the permitted maximum ${cap}`);
    }
    if (crop !== crop.toUpperCase()) {
      throw new Error(`crop policy ${file}: crop names must be upper case, got ${crop}`);
    }
  }

  return {
    currency: raw.currency || 'INR',
    maxRatePerAcre: cap,
    crops: crops.sort(),
    /**
     * The rate for a crop, or null when this policy does not lend against it.
     * Null is a business answer, not an error.
     * @param {unknown} crop
     */
    rate(crop) {
      if (typeof crop !== 'string') return null;
      return Object.hasOwn(rates, crop) ? rates[crop] : null;
    },
  };
}

/**
 * The farm-credit decision.
 *
 * @param {{farmer: Record<string, unknown>, land: Record<string, unknown>}} presented
 *        verified minimum-disclosure claims, keyed by role
 * @param {{rate: (crop: unknown) => number|null}} policy
 * @returns {{outcome: 'ELIGIBLE', farmerId: string, cropType: string, cultivatedAreaAcres: number,
 *            ratePerAcre: number, maximumLoan: number}
 *          | {outcome: 'NOT_ELIGIBLE', reason: string}}
 */
export function decideFarmCredit({ farmer, land }, policy) {
  if (!farmer || !land) {
    throw rejected('the presentation did not carry both a farmer and a land credential');
  }

  // 1. Correlation, before any business rule. Both credentials must name the
  //    same farmer. A mismatch means the holder presented two credentials that
  //    do not belong together, which is a verification failure — not a farmer
  //    who happens to be ineligible.
  //
  //    This is only meaningful because the generic verifier has already proven
  //    both credentials are bound to the same presenting holder; matching
  //    strings alone would be satisfied by two credentials collected from
  //    different people (REQUIREMENTS §4).
  const farmerId = farmer.farmerId;
  if (typeof farmerId !== 'string' || farmerId.length === 0) {
    throw malformed('the farmer credential carried no farmerId');
  }
  if (typeof land.farmerId !== 'string' || land.farmerId.length === 0) {
    throw malformed('the land credential carried no farmerId');
  }
  if (farmer.farmerId !== land.farmerId) {
    throw rejected('the two credentials name different farmers');
  }

  // 2. Registration. Strict boolean, for the reason the Age module spells out:
  //    the string "false" is truthy, and a lending gate that approves on it is
  //    the class of bug this showcase exists to prove absent.
  if (typeof farmer.registeredFarmer !== 'boolean') {
    throw malformed('registeredFarmer is not a boolean assertion');
  }
  if (!farmer.registeredFarmer) {
    return { outcome: 'NOT_ELIGIBLE', reason: 'the farmer registry does not list this person as a registered farmer' };
  }

  // 3. Ownership.
  if (typeof land.ownershipStatus !== 'string' || !OWNERSHIP_STATUSES.includes(land.ownershipStatus)) {
    throw malformed(`ownershipStatus is not one of ${OWNERSHIP_STATUSES.join(', ')}`);
  }
  if (land.ownershipStatus !== 'ACTIVE') {
    return { outcome: 'NOT_ELIGIBLE', reason: 'no active land ownership' };
  }

  // 4. Cultivated area. Malformed precision throws; zero is a business answer.
  const hundredths = acresToHundredths(land.cultivatedAreaAcres);
  if (hundredths === 0) {
    return { outcome: 'NOT_ELIGIBLE', reason: 'no cultivated area is recorded against this land' };
  }

  // 5. Crop policy. A crop outside the policy is NOT ELIGIBLE, not an error:
  //    the registry's vocabulary deliberately includes crops we do not lend
  //    against, so this path is exercised by a real fixture.
  const ratePerAcre = policy.rate(land.cropType);
  if (ratePerAcre === null) {
    return {
      outcome: 'NOT_ELIGIBLE',
      reason: `${typeof land.cropType === 'string' && land.cropType ? land.cropType : 'the crop'} is not in the approved lending policy`,
    };
  }

  return {
    outcome: 'ELIGIBLE',
    farmerId,
    cropType: land.cropType,
    cultivatedAreaAcres: hundredthsToAcres(hundredths),
    ratePerAcre,
    maximumLoan: maximumLoan(hundredths, ratePerAcre),
  };
}

function malformed(message) {
  return Object.assign(new Error(message), { code: 'MALFORMED_CLAIM' });
}

function rejected(message) {
  return Object.assign(new Error(message), { code: 'CORRELATION_FAILED' });
}

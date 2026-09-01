// Deterministic acreage and currency arithmetic.
//
// REQUIREMENTS §6: "Calculations must avoid floating-point currency errors.
// Acreage precision and currency rounding must be deterministic and documented."
// This is that documentation, in the only place that cannot drift from the code.
//
// The rule: acreage carries at most two decimal places, and the loan is a whole
// number of rupees. Both are computed in integers — hundredths of an acre, and
// rupees — so no intermediate value is ever a fraction of a rupee.

/** Hundredths of an acre. Two decimal places, matching config/policy/crop-rates.json. */
export const ACREAGE_SCALE = 100;

/**
 * Converts an acreage claim to integer hundredths.
 *
 * A claim that is not a finite non-negative number, or that carries more
 * precision than the policy recognises, is a MALFORMED_CLAIM rather than a
 * business answer: the registry schema promises at most two decimals, so a third
 * means the credential does not carry what the schema said it would. Following
 * the Age module, that is a verification problem — the caller turns it into
 * REJECTED / UNABLE TO VERIFY, never NOT ELIGIBLE.
 *
 * @param {unknown} acres
 * @returns {number} integer hundredths of an acre
 */
export function acresToHundredths(acres) {
  if (typeof acres !== 'number' || !Number.isFinite(acres) || acres < 0) {
    throw malformed(`cultivated area is not a non-negative number: ${JSON.stringify(acres)}`);
  }

  const scaled = acres * ACREAGE_SCALE;
  const rounded = Math.round(scaled);
  // 4.1 is not exactly representable in binary, so 4.1 * 100 is
  // 409.99999999999994 and a strict integer test would reject a legitimate
  // value. The tolerance accepts that representation error while still refusing
  // genuine extra precision such as 4.005 acres.
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw malformed(
      `cultivated area ${acres} carries more than ${String(ACREAGE_SCALE).length - 1} decimal places, ` +
        'which the registry schema does not permit',
    );
  }
  return rounded;
}

/** Back to acres, for display and for echoing the verified input. */
export function hundredthsToAcres(hundredths) {
  return hundredths / ACREAGE_SCALE;
}

/**
 * cultivated acres × rate per acre, in whole rupees.
 *
 * BigInt throughout: at two decimal places and rates up to ₹50,000 an acre the
 * products stay well inside a double, but doing currency in floating point is
 * the kind of shortcut that is correct until the one demo where it is not.
 * Rounding is half-up on the half-rupee, which the +50 before dividing by 100
 * expresses exactly.
 *
 * @param {number} hundredths integer hundredths of an acre
 * @param {number} ratePerAcre whole rupees per acre
 * @returns {number} whole rupees
 */
export function maximumLoan(hundredths, ratePerAcre) {
  if (!Number.isInteger(hundredths) || hundredths < 0) {
    throw malformed(`acreage must be integer hundredths, got ${hundredths}`);
  }
  if (!Number.isInteger(ratePerAcre) || ratePerAcre <= 0) {
    throw new Error(`crop rate must be a positive whole number of rupees, got ${ratePerAcre}`);
  }
  const rupees = (BigInt(hundredths) * BigInt(ratePerAcre) + 50n) / 100n;
  return Number(rupees);
}

/**
 * Indian digit grouping: ₹1,20,000 rather than ₹120,000.
 *
 * The customer-facing figure in PRODUCT is written this way, and a demo that
 * shows a rupee amount grouped in thousands reads as a placeholder to the
 * audience it is meant for.
 *
 * @param {number} rupees
 */
export function formatIndianRupees(rupees) {
  if (!Number.isInteger(rupees) || rupees < 0) throw new Error(`not a rupee amount: ${rupees}`);
  const digits = String(rupees);
  if (digits.length <= 3) return `₹${digits}`;
  // Last three digits, then pairs: 1,20,000 / 12,34,56,789.
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `₹${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

function malformed(message) {
  return Object.assign(new Error(message), { code: 'MALFORMED_CLAIM' });
}

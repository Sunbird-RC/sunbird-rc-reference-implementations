// Deterministic percentage arithmetic.
//
// REQUIREMENTS §4: "Percentages are decimal values from 0 through 100 with
// deterministic precision." DESIGN §8: "Percentage comparisons use deterministic
// decimal arithmetic." This is that documentation, in the only place that cannot
// drift from the code.
//
// Why it matters here more than it looks. Both policies turn on a threshold —
// 60 for School and College, 70 for the University under the Master's rule, 60
// under the job rule — and a threshold is exactly where floating point embarrasses
// you. `0.1 + 0.2 !== 0.3` is the famous case; the one that would bite this
// iteration is a percentage that arrives as 69.99999999999999 and silently fails
// a `>= 70` rule that a human reading the registry would say it passes.
//
// So percentages are compared as integer HUNDREDTHS. A boundary is then exact and
// testable: 60 passes `>= 60`, 59.99 does not, and no comparison depends on how a
// decimal survived JSON.

/** Hundredths of a percent. Two decimal places, matching the registry schemas. */
export const PERCENTAGE_SCALE = 100;

/** The largest percentage the schemas permit. */
export const MAX_PERCENTAGE = 100;

function malformed(message) {
  return Object.assign(new Error(message), { code: 'MALFORMED_CLAIM' });
}

/**
 * Converts a percentage claim to integer hundredths.
 *
 * A claim that is not a finite number, is outside 0–100, or carries more
 * precision than the schema promises is a MALFORMED_CLAIM rather than a business
 * answer. That distinction is the same one the Agriculture module keeps: the
 * registry schema promised at most two decimals, so a third means the credential
 * does not carry what it said it would, and the caller turns that into
 * REJECTED / UNABLE TO VERIFY — never NOT ELIGIBLE.
 *
 * @param {unknown} value
 * @param {string} label which credential the value came from, for the diagnostic
 * @returns {number} integer hundredths of a percent, 0–10000
 */
export function percentageToHundredths(value, label = 'percentage') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw malformed(`${label} is not a finite number: ${JSON.stringify(value)}`);
  }
  if (value < 0 || value > MAX_PERCENTAGE) {
    throw malformed(`${label} ${value} is outside 0-${MAX_PERCENTAGE}, which the registry schema does not permit`);
  }

  const scaled = value * PERCENTAGE_SCALE;
  const rounded = Math.round(scaled);
  // 72.35 is not exactly representable in binary, so 72.35 * 100 is
  // 7234.999999999999 and a strict integer test would reject a legitimate value.
  // The tolerance accepts that representation error while still refusing genuine
  // extra precision such as 72.355.
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw malformed(
      `${label} ${value} carries more than two decimal places, which the registry schema does not permit`,
    );
  }
  return rounded;
}

/**
 * Is the claimed percentage at or above the threshold?
 *
 * Both policies are written with `>=`, so the boundary VALUE ITSELF passes. That
 * is a product decision, not an implementation detail, and the tests pin it at
 * 59.99 / 60 / 60.01 and 69.99 / 70 / 70.01 so it is evidence rather than
 * assumption.
 *
 * @param {unknown} value the claimed percentage
 * @param {number} threshold a whole or two-decimal percentage
 * @param {string} label for the diagnostic if the claim is malformed
 */
export function meetsThreshold(value, threshold, label = 'percentage') {
  return percentageToHundredths(value, label) >= percentageToHundredths(threshold, `${label} threshold`);
}

/** Formats a verified percentage for display, without inventing precision. */
export function formatPercentage(value) {
  const hundredths = percentageToHundredths(value);
  const whole = Math.trunc(hundredths / PERCENTAGE_SCALE);
  const fraction = hundredths % PERCENTAGE_SCALE;
  if (fraction === 0) return `${whole}%`;
  if (fraction % 10 === 0) return `${whole}.${fraction / 10}%`;
  return `${whole}.${String(fraction).padStart(2, '0')}%`;
}

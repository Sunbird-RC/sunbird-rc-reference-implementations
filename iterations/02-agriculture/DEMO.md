# Iteration 02 — Agriculture / Rural Credit: Final Demo Expectations

**Audience:** Potential customers and Anand's iteration acceptance review  
**Presenter:** Kartheek  
**Channel:** Real customized Paradym-based wallet on a phone and the mock bank website on a separate screen

> Inji references later in this historical demo brief are superseded by the
> approved programme-wide wallet decision. The delivered wallet demonstration
> is the accepted channel.

The final demonstration must tell one continuous customer story. Kartheek should
show the working applications and outcomes; coding-agent activity belongs in the
repository history and evidence, not in the customer demo.

## Demonstration sequence

### 1. Obtain the Farmer credential

- Open Inji Wallet and show the Agriculture issuer directory.
- Show only the Farmer Registry and Land Registry.
- Select the Farmer Registry and authenticate through Keycloak as a synthetic farmer.
- Receive, review, accept, and store the `FarmerIdentityCredential`.

**Visible outcome:** The wallet contains a Farmer credential from the clearly
identified Farmer Registry.

### 2. Obtain the Land credential

- Select the Land Registry and complete its authorised issuance flow.
- Receive, review, accept, and store the `LandOwnershipCredential`.
- Show that the Farmer ID in the two credentials corresponds while National ID
  remains an issuer-side value.

**Visible outcome:** The wallet contains two credentials from two independent,
clearly identified issuers.

### 3. Prove persistence

- Completely close Inji Wallet.
- Reopen and unlock it.
- Show that both credentials remain available.

**Visible outcome:** Both credentials survive a cold restart.

### 4. Apply for farm credit

- Open the mock bank website on a separate screen.
- Start the farm-credit check and display its QR code.
- Scan the QR with Inji Wallet.
- Show the named bank, purpose, both selected credentials, requested claims, and
  the consent action.
- Consent and return the presentation to the bank.

**Visible outcome:** One consented presentation uses both credentials while
showing only the minimum information required by the bank.

### 5. Show an eligible decision

- Use an eligible Paddy or Wheat farmer.
- Show the verified Farmer ID match, crop, cultivated acreage, applicable rate,
  and calculation.

**Visible outcome:**

```text
ELIGIBLE
Crop: <crop>
Cultivated Area: <acres>
Applicable Rate: ₹<rate> per acre
Maximum Loan: ₹<calculated amount>
```

### 6. Show the other outcomes

- A valid but ineligible farmer produces `NOT ELIGIBLE` with a clear business reason.
- Mismatched, tampered, untrusted, or otherwise unverifiable credentials produce
  `REJECTED / UNABLE TO VERIFY`, not ordinary ineligibility.
- Refusing the request produces `NO DATA SHARED` and no loan decision.

## Customer-demo quality gate

- No issuance QR or issuer-counter page.
- No Age or unrelated issuer in the Agriculture wallet configuration.
- No unexplained unknown-organisation warning.
- No National ID, name, address, raw credential, or unrelated claim reaches the bank.
- No manual database edits, hardcoded verdicts, or hidden technical intervention
  during the journey.
- The four outcomes remain visibly distinct: `ELIGIBLE`, `NOT ELIGIBLE`,
  `REJECTED / UNABLE TO VERIFY`, and `NO DATA SHARED`.
- Any known limitation is stated accurately and is not presented as implemented.

## Repository evidence accompanying the demo

The iteration branch must also contain the line-by-line validation table,
automated positive and negative results, privacy evidence, Age regression result,
exact component and Inji versions, clean-checkout instructions, known deviations,
and the final commit reference. All feedback and closure work remains on
`iteration/agriculture-02-rural-credit` until Anand signs off.

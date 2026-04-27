# Jobs Commercial and Accounting Next Steps

The next major build phase should turn the existing Jobs area into a full commercial workflow, then tie completed work into accounting-ready review.

## Current strengths already in the repo

The Jobs area already carries important groundwork:
- pricing fields
- tax rate fields
- discount mode and markup fields
- approval status fields
- change orders
- estimate and work-order structures
- job financial rollups
- payroll and material usage hooks

That means the next pass should expand and connect what already exists instead of starting over.

## Best next implementation order

1. Quote and estimate discipline
   - estimate header completeness
   - estimate line pricing and discounts
   - approval/request flow
   - conversion rules to agreement / work order / job

2. Commercial approval controls
   - discount approval thresholds
   - margin warnings
   - signoff audit trail
   - client-facing vs internal-only notes separation

3. Costing depth
   - labour, material, equipment, subcontract, delay, repair, tax, and change-order rollups
   - estimate vs actual variance reporting
   - completion profitability review

4. Job completion trigger
   - explicit completion review state
   - accounting-ready queue
   - invoice / receivable / journal trigger coordination
   - closeout evidence and supervisor signoff checks

5. Backend accounting follow-through
   - post-completion review queue
   - AR/AP coordination
   - completion package and summary export
   - margin/profit evaluation with variance explanation

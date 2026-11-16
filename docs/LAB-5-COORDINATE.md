# Lab 5 — Coordinate: Keep humans in the loop for consequential actions

**Goal:** show how a human approval checkpoint and an audit trail coordinate agent actions with accountable people.

## Why coordination matters

Some actions are too consequential to execute immediately based only on a model-generated tool call. A price change or inventory update should be visible, reviewable, and explicitly approved or rejected.

## Exercise A — Create a pending price change

In Assistant, ask:

~~~text
Set the Whale Mascot Socks price to ₹1.
~~~

Expected:
- The model requests update_price.
- The API validates the SKU and price.
- A pending action is created.
- The product price remains unchanged until a human decision.

Open Coordinate and inspect the pending approval.

## Exercise B — Approve one action

Approve the price change in the UI. Then revisit Store and Activity.

Expected:
- The pending action becomes approved.
- The API applies the database update within a transaction.
- The audit log records the approval and result.
- The product price now reflects the approved value.

## Exercise C — Reject another action

Ask:

~~~text
Set the stock of DCK-SOCK-007 to 5.
~~~

Reject it in Coordinate.

Expected:
- The pending action becomes rejected.
- The inventory remains unchanged.
- The audit log records the rejection.

## Exercise D — Verify the evidence

Check:
- approval status and timestamp;
- before/after product values;
- Activity entries for pending, approved, and rejected decisions.

The approval transaction locks the pending row so the same request cannot be approved twice.

## Success criteria

- [ ] Price change is pending before review.
- [ ] Approval applies the mutation.
- [ ] Rejection leaves the value unchanged.
- [ ] Activity records the decision.

## Production caveat

The current approval endpoints are unauthenticated and the app is intended for a trusted local lab only. The published ports bind to localhost. Do not expose this prototype publicly or on a shared network. A production workflow needs authenticated reviewer identity, role-based authorization, separation of duties, CSRF protection, rate limiting, notifications, and tamper-resistant audit retention.

## Discussion

Coordination adds accountability and a deliberate human decision point. It does not mean every tool call needs approval; reserve human review for actions with meaningful business impact.

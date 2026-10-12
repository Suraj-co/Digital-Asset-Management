# ADR 0007 — Client form and query libraries

## Status

Accepted. Module 1.

## Problem

The platform stack names React Hook Form and TanStack Query. Module 1 has one example field and one health request. Installing either library without a caller would leave an unused dependency.

## Decision

- The design-system example keeps its value in component state and validates it with Zod. It does not submit.
- Environment status keeps a local effect around `fetchHealthReport`. One page owns that request. Nothing else reads the cache.
- React Hook Form is installed with the first form that posts to the API. That form uses a Zod resolver, `aria-invalid`, and `aria-describedby`, matching the example field.
- TanStack Query is installed with the first list or mutation that more than one screen must refresh. Health can move onto that client then. It does not move earlier just to occupy the dependency list.

## Alternatives

- Install both now and wrap the example and the health request. Rejected. The wrappers would be the only callers, and a later module would still have to design the real query keys.
- Skip Zod on the example and wait for React Hook Form. Rejected. The page needs to show a field error today, and Zod is already the web contract library (ADR 0006).

## Trade-offs

The repository does not yet import two libraries that the stack list names. A reviewer should reject a second form pattern (another uncontrolled form library, or ad-hoc JSON posts with no schema) when those libraries arrive.

## Security

The example field never leaves the browser. No new client secret.

## Scaling limit

The health effect refetches only when the user presses Refresh or the page mounts. That is one request, not a polling loop.

## Revisit when

Module 3 installed React Hook Form for sign-in. Module 4 installed TanStack Query for the company list shared by the menu and the Companies page. Health still uses its own effect.

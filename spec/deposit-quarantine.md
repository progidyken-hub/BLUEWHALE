# Deposit quarantine policy

This page recommends how an exchange should handle a deposit that cannot be routed to a user. A deposit is **quarantined** when the library cannot say who it belongs to, or when the destination or sender is a contract. A quarantined deposit is held and not credited.

The reason codes below are a recommendation for exchange systems. The library does not emit them. They are derived from the warning codes and the destination error in `packages/core-dart/lib/src/address/codes.dart`. The same list is in `spec/warnings.md`, added in #485.

## Decision table

| Library outcome | Quarantine reason | Recommended action |
|---|---|---|
| `destinationError` is `INVALID_DESTINATION` (destination is a C-address) | `QUARANTINE_CONTRACT_DESTINATION` | Do not credit. Hold the funds and return them to the sender under your refund policy. |
| `routingId` is empty on a G-address with no memo | `QUARANTINE_NO_ROUTING_ID` | Hold. Ask the sender for the memo. Run the SEP-0029 check if your account requires a memo. |
| `MISSING_REQUIRED_MEMO` | `QUARANTINE_NO_ROUTING_ID` | Same as above. |
| `MEMO_TEXT_UNROUTABLE` or `UNSUPPORTED_MEMO_TYPE` | `QUARANTINE_UNROUTABLE_MEMO` | Hold. The memo cannot be mapped to a routing ID. Ask the sender. |
| `MEMO_ID_INVALID_FORMAT` | `QUARANTINE_INVALID_MEMO_ID` | Hold. The memo ID is malformed or above the uint64 range. Ask the sender. |
| `CONTRACT_SENDER_DETECTED` | `QUARANTINE_CONTRACT_SENDER` | Review before crediting. Confirm where a refund would go before returning funds, because a contract sender may not be able to receive it like a classic account. |

A deposit with an M-address always has a routing ID, so it is not quarantined for a missing memo. `spec/routing-state-machine.md`, added in #487, covers the open point about a memo sent with an M-address.

## Recommended handling

1. Do not credit any user account.
2. Move the funds to a suspense account, and record the transaction hash, the destination, the memo and the reason code.
3. Contact the sender, or the user you believe sent it, with the reason.
4. Resolve it as one of: credited after the sender supplies the missing data, refunded, or escalated for manual review.
5. Set a holding period and an escalation owner in your own compliance policy. This page does not set either.

## Example

The snippet below maps a routing result to a reason. It is illustrative. `RoutingResultLike` is a minimal shape built from the fields in `spec/vectors.json`, not an exported type.

```ts
type QuarantineReason =
  | "QUARANTINE_CONTRACT_DESTINATION"
  | "QUARANTINE_NO_ROUTING_ID"
  | "QUARANTINE_UNROUTABLE_MEMO"
  | "QUARANTINE_INVALID_MEMO_ID"
  | "QUARANTINE_CONTRACT_SENDER";

interface RoutingResultLike {
  routingId: string | null;
  destinationError?: unknown;
  warnings: { code: string }[];
}

function quarantineReason(result: RoutingResultLike): QuarantineReason | null {
  const codes = new Set(result.warnings.map((w) => w.code));

  if (result.destinationError || codes.has("INVALID_DESTINATION")) return "QUARANTINE_CONTRACT_DESTINATION";
  if (codes.has("CONTRACT_SENDER_DETECTED")) return "QUARANTINE_CONTRACT_SENDER";
  if (codes.has("MEMO_ID_INVALID_FORMAT")) return "QUARANTINE_INVALID_MEMO_ID";
  if (codes.has("MEMO_TEXT_UNROUTABLE") || codes.has("UNSUPPORTED_MEMO_TYPE")) return "QUARANTINE_UNROUTABLE_MEMO";
  if (result.routingId === null || codes.has("MISSING_REQUIRED_MEMO")) return "QUARANTINE_NO_ROUTING_ID";

  return null; // routable: credit the user matching routingId
}
```

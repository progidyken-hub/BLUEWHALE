---
"@redishfish/bluewhale-core": minor
---

Add a string intern table for frequent Stellar asset codes and issuers. SEP-0007 URIs now canonicalize `asset_code` (uppercased) and `asset_issuer` through a shared intern table, so repeated values reuse a single string reference instead of allocating a new one on every payment. Frequent codes (XLM, native, USDC, USDT, ...) are pre-seeded. Exposed as `internAssetCode` and `internAssetIssuer`.

# Enrollment receipts

The Pages Function `/submit-enrollment` uses the existing encrypted MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET and MS_GRAPH_TENANT_ID bindings. Never put these in source or Wrangler vars. Optional server-only ENROLLMENT_RECIPIENT defaults to Scott@smartdealer.com; ENROLLMENT_SENDER defaults to scott.anderson@smartdealer.com.

ENROLLMENT_DB is a private D1 binding. `schema.sql` is additive. Receipt rows retain full accepted terms/hash/version, server-resolved price, dealer fields, typed signature, exact consent and server timestamp. No HTTP receipt lookup route exists. Responses are no-store; customer data does not go into URLs or logs. Access and retention must be managed by authorized Cloudflare account operators.

Email is one MS Graph request with exactly the configured recipient and the validated primary-contact address (case-insensitive deduplication). Signer/AP/client-supplied destination overrides are not recipients. Graph 202 means queued, not delivered; individual inbox failures/bounces cannot be detected from this response.

Each request has an opaque client submission ID; the receipt ID and timestamp are generated on the server. An atomic unique payload fingerprint prevents duplicate sends, including concurrent attempts/new client IDs for identical entries. Queue acceptance is persisted. Definite provider rejection sets failed; a timeout/disconnect during send sets uncertain. Neither state is automatically resent. A crash in sending also requires operator review. This deliberately favors no duplicates over blind retry. Users retain their entries and receipt reference; a same-payload retry returns the stored result/status.

For failed/uncertain/sending receipts, authorized support must inspect the private row and sender Sent Items/Exchange delivery evidence before considering any resend. Do not reset state or delete a row merely to retry. No public admin endpoint is supplied. Do not print/export live PII into ordinary logs. Stored receipt contents are immutable through this handler; only state is updated.

Abuse limits: same-origin JSON requests, bounded streamed body, allowed-field validation, email/header-injection rejection, honeypot, persistent atomic five valid requests/IP/hour and twenty/contact/day. Limiter identifiers are SHA-256 hashes; expire after two days. These controls reduce abuse but are not identity verification or a CAPTCHA. Additional Cloudflare WAF/bot policy can be managed at the account level.

`server/agreement.json` was copied from the current enrollment source (review-7) without changing legal terms. The Function uses that authority, rejects mismatched client versions/hash/text, and resolves known product combinations from its price table. Keep the embedded browser JSON and server canonical data identical when an approved legal update is made.

Download is explicitly HTML; the adjacent Print / Save as PDF uses the browser print dialog. Both use the server-acknowledged receipt and legal text, not editable fields. They do not claim a Company countersignature, activation or inbox delivery.

Deploy only `release-public`, never the repository root. `build-public.py` preserves public assets/documents from the previous dist stage and overlays tracked source, using an allowlist. Archive a previous release-public directory before rebuilding. Functions are compiled separately by Wrangler from functions/ and import server data into the private Worker bundle. Do not place server/, tests/, Wrangler files or evidence in public staging.

# External response invitations — audit and implementation plan

Status: **IN DEVELOPMENT; not a released capability.** Authoritative HTTP
shapes are Zod schemas and `contracts` in `packages/contracts/src/index.ts`.
This document records semantics and the evidence required before delivery.

## Existing capability audit (2026-10-06, base 9bc16ea)

| Boundary | Current evidence | Gap / reuse |
|---|---|---|
| User/auth | `auth.service.ts`, nullable passwordHash, organization-bound login | No invitation login; null password does not provide an external workflow |
| Sessions | Hashed random tokens, server expiry/idle timeout/revocation, HttpOnly cookie, CSRF | Only account sessions; never issue one to an invitation |
| Authorization | `AuthGuard`, `AccessService.project/mutate`, active membership and roles | All response endpoints require account login; no capability guard |
| Assignments | Unique question/member, active assignment, published question | Reuse explicit assignments for scoped internal invited respondent |
| Responses | Unique question/respondent; drafts, version checks and request-id replay | Already supports N independent respondents; reuse rather than duplicate |
| Evidence | ResponsesService, file validation, SHA-256, private S3/local abstraction, reconciliation | Reuse all validation and ownership rules, add invitation permission check |
| Clarifications | Ownership of submitted response and thread; reply endpoint | Reuse; external session must reach only its own selected questions/threads |
| Audit | Actor FK, snapshots, request IDs and results; raw errors not logged | Add invitation creation/access/revocation/renewal and explicit actor type |
| Rate limit | PostgreSQL login-attempt limiter | Add bounded persisted public-capability limits; no raw tokens/IP in audit |
| URLs/UI | Session component gates private routes; no invitation token exchange | A link to a private question opens login, not an external form |
| Expiry/revocation | Account session mechanisms only | Invitation lifetime and independent revocation are missing |

Conclusion: the requested capability does **not** exist. No existing public
form or second implementation will be maintained alongside the new flow.

## Consumer and contract matrix

| Operation | Consumer | Authority / scope | Consistency |
|---|---|---|---|
| Create/list/revoke/renew invitations | Authenticated analyst/admin | Organization + project membership, published selected questions | Project transaction lock, version checks; scope immutable |
| Non-nominal policy | Project ADMIN | Explicit owner permission plus installation identity policy | Project version check and audit |
| Exchange link | External browser | Hash of 256-bit random capability, configured organization, expiry/revocation | Separate invitation session; never ordinary login |
| Resume/read | External browser | Live invitation + selected published questions + own contributions | Recheck on each request, no other project navigation |
| Draft/submit | External browser | Same answer rules as account participant | Existing lockVersion + requestId idempotency, one respondent per invitation |
| Evidence | External browser | Explicit allowEvidence, same ownership and scoped question | Existing MIME/size/hash/staging/reconciliation pipeline |
| Clarification/reply | External browser | Own response/thread and authorized question | Existing review commands and optimistic concurrency |

Public errors: unavailable capabilities use one generic message regardless of
unknown/expired/revoked token; 429 for abuse, 403 for origin/CSRF, 409 for
concurrency/replay mismatch, 400 for malformed payload and 413 for upload size.
No response reveals why a different invitation is unavailable.

## Identity and compatibility decision

Responses, evidence, review and audit currently have required User FKs. Reuse
that author identity with a new **INVITATION** kind, no password and no ordinary
session. It is an encapsulated persistence principal, not a customer account:
hidden from account/member administration and assignment pickers, cannot be
reset/reactivated as a regular user or added to another project. Its immutable
invitation binding must be identifiable in review and audit as link-based,
not an authenticated person's identity. Existing users default to ACCOUNT.

One invitation means one respondent, with one response stream per selected
question. Three recipients require three invitations. Sharing a link shares
the same capability/response stream; the product must explain that this does
not authenticate the physical person. No IP identity inference, OTP or email
sending is introduced. The analyst distributes the link through an appropriate
private channel. Name/email/organization are optional recorded attribution,
not verified facts. Installation policy can require NONE, NAME, EMAIL or BOTH.
Non-nominal invitations additionally require explicit project ADMIN permission.
An existing area is chosen explicitly for the current response-area model;
its choice neither assigns a person nor proves their affiliation.

## Token and session rules

- Random 32-byte base64url token; store SHA-256 only. Link is `/invite#TOKEN`,
  so normal HTTP access logs do not receive the secret. Remove the fragment from
  browser history immediately after capturing it; no localStorage/sessionStorage.
- Exchange via same-origin JSON POST; separate HttpOnly/Secure/SameSite cookie,
  separate CSRF token, server-side invitation session. Normal auth rejects
  invitation identities and the external session never authorizes private APIs.
- Multiple tabs must not silently submit under another invitation after cookie
  replacement: requests carry the expected invitation ID and are rejected if
  it differs from the session binding. Cookies alone are insufficient here.
- No token in logs, audit snapshots, exception text, analytics or persisted
  command results. Returned once at create/renew; losing it requires explicit
  renewal. Creation requestId prevents duplicate invitations but never recovers
  plaintext token through replay.
- Expiration: default configurable (7 days), explicit date allowed up to configured
  maximum. Renewal rotates the token and invalidates earlier sessions, preserves
  respondent/responses, and is available only to authorized staff. Revoked links
  stay revoked; renewal must not silently undo deliberate revocation.
- Revocation/expiry stop access, including evidence and pending sessions. Submitted
  history is retained. Mutations and revocation use the same project lock so an
  operation cannot authorize before revocation and commit afterwards unchecked.
- Limits protect both token exchange and subsequent public operations. Invalid
  tokens have uniform errors. Short-lived hashed network buckets are abuse
  protection, not proof of identity; document retention and operator proxy limits.

Security references (principles adapted; an invitation is not a password reset):
[OWASP token guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html),
[OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Scope, drafts, submission and clarification

Invitation scope cannot expand through ordinary membership/assignment APIs.
Creation must reject unpublished, archived, foreign or duplicate questions.
Conditional dependencies must be included explicitly; do not silently expose an
unselected parent or infer a condition from a follow-up grouping. Content remains
subject to current publication/lifecycle/condition rules; no copy of the question
model or answer validator.

Resume works with the original link before expiry. Submit is per question, as
for authenticated participants. Repeated requests with the same idempotency key
must return the original result; a different concurrent submission with stale
version must conflict. A question answered by invitation A remains answerable
by invitations B and C. A deliberate correction follows the existing versioned
response rules (including review invalidation), never overwrites submitted
history; the UI separates viewing a receipt from explicitly editing a correction.

An analyst can request clarification on an external submission. The invited
respondent can read/reply using the live link. If expired, staff renews its link
for the same invitation/response identity, without creating a new account.
Only that person's thread is visible; evidence download remains backend-authorized.

Staff UI distinguishes invitations from assigned accounts and offers useful
derived states: pending, opened, draft, partially submitted, submitted, expired,
revoked. Opening is evidence of capability use, not proof the intended person
read it. List is paginated; design supports later multi-recipient creation but
this phase does not introduce a CSV/email campaign engine.

## Implementation and completion evidence (unchecked = not complete)

- [x] Inspect auth/users/assignments/responses/evidence/review/audit/limiting and UI.
- [x] Define shared contract first and document threat model/semantics.
- [x] Schema + migration from empty and existing database, invariants and runtime grants.
- [x] Management authorization, scoped sessions, expiry/revoke/renew and rate limiting.
- [x] Reuse response/evidence/clarification engines without private-auth bypass.
- [x] Analyst creation/list/revoke/renew and selection integration.
- [x] Simple external UI, receipt/correction, draft resume, evidence and clarification.
- [x] Token valid/invalid/modified/expired/revoked, origin/CSRF/rate tests.
- [x] Cross-question/project/organization/respondent/evidence isolation tests.
- [x] Concurrent writes, revocation race, replay/double submit and no secret logging.
- [x] 1 invitation/1 question, 3/same question, 1/many; draft/exit/resume.
- [x] Clarification including expired-link renewal, evidence and account regression.
- [x] Mobile 390px, keyboard/focus, axe and product review.
- [x] User/operator docs, configuration, privacy/limits and contribution/source audit.
- [ ] Full pertinent local tests + real PostgreSQL/S3 + remote PR CI.
- [ ] Clean PR review, allowed merge, verify main; no automatic release.

Institutional downstreams remain untouched. Recommend a minor pre-1.0 release only after all
requirements above pass; do not call this capability ready from contract tests alone.

## Implementation evidence — work in progress, 2026-10-06

The schema now uses `User.invitationOnly` (existing accounts default to false)
as the internal discriminator described above. Runtime identity proofs are held
outside serializable User objects; account sessions cannot be created for an
invitation principal. PostgreSQL constraints seal immutable invitation scope
and prohibit expanding membership/assignment scope or changing identity kind.

Implemented, with further verification still required:

- Additive migration, management endpoints, explicit external endpoints,
  separate session/CSRF and multi-tab binding, rotation/revocation and rate limits.
- Shared answer/review engines; a shared evidence HTTP service retains the same
  byte parsing, admission limit and download headers for both authentication modes.
- Authorized review uses a historical projection so expiry does not hide or erase
  submitted sources. It does not grant an expired respondent access.
- Editor selection opens invitation creation; project management lists, renews
  and revokes invitations. External UI includes drafts, submissions, corrections,
  evidence, clarification and unsaved-change protection. Browser flows now have desktop/mobile and accessibility coverage; final
  product review and the remote gate remain required.

Executed evidence on this branch:

| Check | Observed result |
| --- | --- |
| Prisma format / validate / generate | PASS |
| Migration chain from empty PostgreSQL 18.6 | PASS during integration setup |
| Populated pre-invitation schema upgrade | PASS: 17 tables retain all original values; account session still authenticates; draft, submitted revision, evidence hash/links and audit preserved; rerun is idempotent |
| Complete PostgreSQL integration | 113/113 PASS, no skipped tests |
| Invitation integration | 18/18 PASS on local storage: management policy, three independent respondents, resume, replay, scope/identity restrictions, renewal, revoke, expiry, audit hashes, HTTP cookie/CSRF/origin separation, concurrent submissions, queued revoke/write race, malformed-token rate limit, 35 independent invitees behind a shared network, bounded security events without credentials, renewed-link clarification isolation, authorized evidence upload/association/submission/download and size/MIME/hash checks; foreign-organization isolation, hidden-principal administration, multiple questions/MATRIX, audit/storage rollback, orphan reconciliation and application restart |
| Existing response/evidence integration | 17/17 PASS using local test storage |
| Existing review integration | 11/11 PASS |
| Real S3 / VersityGW 1.8.0, isolated bucket and restricted account | 39/39 PASS in the clean container gate: 18 invitation, 17 existing response/evidence and 4 storage tests. Private bucket, restricted account, missing/unavailable object, conditional writes and reconciliation included |
| Docker install and proxy/restart | PASS: fresh PostgreSQL/VersityGW volumes, migrations, bootstrap and account evidence smoke; invitation exchange, CSRF/origin/isolation, draft and evidence through Nginx; real stack restart preserves both flows and SHA-256; token/cookie/CSRF absent from inspected proxy/backend logs |
| External browser flow | 5/5 PASS, including mobile clarification return/reply and analyst create/renew/revoke; 1440px and 390px: keyboard entry, axe, draft/save/exit/same-link resume, S3 evidence, submit, receipt and download; switching active invitations preserves unsaved work on cancel |
| Complete browser regression | 45/45 PASS on a fresh database/bucket; existing account participant, review/conflict, imports, editor and bulk flows included; no retries/skips |
| Unit/component (including contract and client token tests) | 140/140 PASS |
| Typecheck, lint, frontend/backend build | PASS |
| Compose configuration / diff whitespace | PASS |
| Gitleaks, all versionable working files | 0 findings; existing exact exceptions unchanged |

The first review-suite run encountered an occupied local port and received an
unrelated server's HTML. `ACTA_REVIEW_TEST_PORT` now permits an explicit isolated
port (the existing default remains unchanged). The subsequent run used its own
port and passed all assertions; no service or test assertion was disabled.

Still required before the feature can be declared ready:

- DCO commit, PR, remote CI, review, permitted merge and verification of main.

The first external browser runs reproduced a real same-document navigation bug:
after logout, reopening the original fragment link left the closed screen visible.
The client now captures and removes a new fragment, exchanges it once, and reopens
the invitation. A link opened over active work requires confirmation; cancellation
preserves the draft. Both desktop/mobile flows passed after this fix, without retries.

The management browser test also found that the create dialog omitted selected
question IDs from its request. The form now sends the explicit scope, and the
browser test asserts a successful creation before checking renewal and revocation.
Client generation checks prevent an older in-flight exchange or response from
replacing a newer invitation's context; a deterministic unit test covers the race.

No PR, merge or release has been performed for this feature. No downstream
repository or existing working-instance data has been modified.

The initial full-browser run passed 44/45, with the login test expecting a different
organization name from the disposable seed. A second run reused modified demo data
and was stopped after stale-fixture failures. A new database and bucket, with an
explicit matching fictitious organization name and initial password-change flow,
passed all 45 tests. Product assertions were not weakened and no retries were added.
The CI verify job now prepares its own clean demo database and runs the full browser
suite; the selfhosting job includes external-invitation S3 tests and proxy/restart smoke.
These remote jobs have not run for this branch yet.

The local Docker host had exhausted its default network pools and the first chosen
port was occupied. The isolated gate used temporary, non-overlapping subnets and
an available loopback port; no existing networks or volumes were pruned. Those
host-only overrides are not part of the product. All service images and application
configuration used the normal Compose deployment.

Final local product review: the recipient has no account navigation, administrative
roles or external IDs in the form. Captured desktop/mobile receipt screens were
visually inspected. Existing keyboard/axe flows cover creation, responding,
submission and management; two additional browser checks pass for unavailable
links and interrupted saves (text retained, error receives focus, deliberate retry
succeeds). The full 45-test run preceded these two added checks; both added tests
were then run separately without retries. No new product changes followed that run.

The management empty state explains how to create a scoped invitation in Organizar.
Historical review labels invited respondents as `Invitación: <reference>`; stored
snapshots also carry `identityKind: INVITATION`, while the immutable invitation
retains the recorded recipient and scope. Names/email are unverified attribution.
No new dependencies, copied assets or third-party code were introduced. New code
uses the project's existing license and DCO contribution policy. User/operator
instructions cover lifecycle, sharing risks, storage, privacy, rate budgets and
configuration. Automated tests are not a substitute for usability research with
human participants, and no WCAG conformance claim is made.

# ImpactValue SROI — Backend API

JSON REST API for the SROI calculator. PHP 8.1+ with SQLite, **no Composer dependencies**. It is designed to be
hosted separately from the frontend (CORS is configurable; auth is by bearer token).

## Run it

```bash
cd backend
cp .env.example .env        # set CORS_ALLOWED_ORIGINS to your frontend's origin(s)
php bin/migrate.php         # creates storage/sroi.sqlite
php bin/seed.php            # optional: reference data + the Naresuan University organization (creates NO users)
php bin/user.php add --email=you@nu.ac.th --name="Your Name" --role=owner   # prompts for the password
php -S localhost:8000 -t public public/index.php
php tests/run.php           # 181 assertions: engine + full API workflow
```

Requires PHP extensions `pdo_sqlite`, `mbstring`, `iconv`, `fileinfo`. In production point the web server's document root at
`backend/public` and rewrite all requests to `index.php`; keep `storage/` writable and outside the web root.
All routes live under `/api/v1`.

## Users

Accounts are managed by hand with `bin/user.php` (it prompts for the password so it stays out of shell history):

```bash
php bin/user.php list
php bin/user.php add    --email=a@nu.ac.th --name="Somchai J." --role=editor   # viewer (default) | editor | owner
php bin/user.php passwd --email=a@nu.ac.th        # also signs that user out everywhere
php bin/user.php remove --email=a@nu.ac.th        # their projects and audit history are kept
```

New users join the Naresuan University organization (or `--org=ID`). Passwords must be 8–200 characters.
The old `demo@impactvalue.local` account is no longer created; if you have an older database that still contains it,
run `php bin/user.php remove --email=demo@impactvalue.local`.

## Conventions

- Percentages are **fractions** (`0.15` = 15%). Money is in the project currency.
- Errors: `{"error":{"code","message","details"}}`. Validation → 422 with per-field `details`; calculation blockers → 422
  `calculation_inputs_invalid` with a list of `{code,message,path}`. Non-members get 404 (not 403) so project existence never leaks.
- Material changes accept `change_reason` (body) or `X-Change-Reason` (header); it is stored in the audit trail with old/new values.
- Auth: `POST /auth/login` → `token`; send `Authorization: Bearer <token>`. There is **no self-registration**: accounts are created by an administrator (see "Users" below). Every route except `/health`, `/meta`, `/auth/login` and `/shared/{token}` requires a token, so a signed-out visitor can load the app but sees no data.

## Endpoints

(`…` = `/projects/{projectId}`)

| Area | Endpoints |
|---|---|
| Public | `GET /health`, `GET /meta` (enums, formulas, glossary), `GET /shared/{token}[?format=pdf\|html\|csv\|json]` |
| Account | `POST /auth/login`, `/auth/logout`, `GET /auth/me` |
| Orgs | `GET/POST /organizations`, `GET/POST /organizations/{id}/members`, `PATCH/DELETE …/members/{userId}` (roles owner/editor/viewer) |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}` (soft delete), `POST …/restore`, `GET …/audit` |
| Step 1 | `…/costs` CRUD, `GET …/summary` (live investment summary) |
| Step 2 | `…/stakeholders` CRUD |
| Step 3 | `…/outcomes` CRUD, `…/evidence` (url/citation/file upload), `GET/POST /organizations/{id}/proxies`, `GET /proxies?q=&category=` |
| Step 4 | `PUT …/outcomes/{id}/adjustment`, `PUT …/outcomes/{id}/year-projections` |
| Step 5 | `GET …/review` (readiness, warnings, per-step completion), `…/scenarios` CRUD, `GET …/scenario-comparison`, `GET …/sensitivity` |
| Step 6 | `GET …/dashboard` (live), `POST …/calculate` (saved run), `GET …/runs[/{id}]`, `GET …/run-comparison?a=&b=`, `POST/GET …/reports`, `GET /reports/{id}/export?format=pdf\|html\|csv\|json[&dataset=outcomes\|investment\|results\|annual\|stakeholders]`, `POST/DELETE /reports/{id}/share` |
| Stateless | `POST /calculator/preview` — send a full snapshot, get the engine result, nothing stored |

## Calculation engine (`src/Domain/Calculation/CalculationEngine.php`)

Pure and deterministic; the only place formulas exist. Reports are built from stored engine output, never recomputed.

```
gross      = quantity × proxy                                   (negative outcomes carry a negative sign)
retained   = gross × persistence       persistence(1)=1; persistence(k)=persistence(k-1)×(1-dropoff_k)
adjusted   = retained × (1-deadweight) × (1-attribution) × (1-displacement)
present    = adjusted / (1+r)^max(0, year − discount_base_year)
SROI       = Σ present / investment        net social value = Σ present − investment
```

Design decisions worth knowing:

- **Nothing is assumed silently.** Discount rate, analysis period and investment basis (`nominal` vs `present_value`) must be set
  before calculating (a 0% rate is valid). Unassessed deadweight/attribution/displacement are stored as `null`, treated as 0 and flagged.
- **No double adjustment.** Projection models: `cohort` (one group, recursive drop-off), `recurring_cohorts` (new entrants yearly, each
  decays by its own age), `independent` (per-year measured quantities; drop-off is *not* applied and a warning is raised).
- **Negative outcomes** use `polarity: "negative"` with a non-negative proxy; positive and negative value are reported separately.
- **Unmonetised outcomes** (`proxy_value: null`) are listed qualitatively. **Warnings** cover missing evidence/justification, assumed
  evidence, possible double counting (`overlap_group`, duplicate costs), truncated horizons, weak-evidence share, zero investment.
- **Scenarios** are overrides on the base inputs. Conservative/Optimistic start empty (no invented assumptions) and are flagged until configured.
- **Reproducibility:** each saved run stores the full input snapshot, result, methodology version and a SHA-256 input fingerprint.
- **Rounding:** each monetary line is rounded to 2 dp and totals are sums of rounded lines (tables always add up).

## Security

Password hashing (`password_hash`), SHA-256-hashed bearer tokens with expiry, login throttling, prepared statements only, whitelist
validation, org-level RBAC with 404 on foreign resources, upload allow-list with content sniffing and non-web-root storage, CSV formula
neutralisation, HTML-escaped exports with a restrictive CSP, share links stored hashed with expiry and revocation, append-only audit log.
`php bin/purge-deleted.php --days=30` permanently removes long-deleted projects (retention).

## Known limitations

- Arithmetic uses PHP floats with explicit 2-dp rounding (`bcmath` isn't assumed). Fine for reporting; revisit if exact decimals at very large magnitudes matter.
- PDF export uses built-in Latin-1 fonts: Thai/other scripts become `?` and ฿ prints as `THB`. Use the HTML export (print to PDF) for full Unicode.
- Not included yet (spec Phase 2/3): Excel export, real-time collaborative editing, organisation templates, portfolio dashboards.
- No proxy values are bundled — every library entry must carry its own source, so nothing unsourced ships by default.
- SQLite suits a single server; the schema is portable to PostgreSQL if you outgrow it.

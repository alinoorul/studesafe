# StudeSafe — Software Requirements Specification & Technology Stack

> This is the **full-scale target** for a multi-school rollout. For the
> single-school prototype (500–1,000 students, one server), see
> [`PROTOTYPE_REQUIREMENTS.md`](./PROTOTYPE_REQUIREMENTS.md).

This document defines functional and non-functional requirements, the
recommended technology stack, and external integrations for StudeSafe, in
support of the architecture described in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

Any place the product description didn't specify a concrete choice is marked
**[ASSUMPTION]** with the reasoning, so it can be reviewed rather than
silently locked in.

## 1. Functional Requirements

### 1.1 Identity, Roles & Onboarding
- **FR-1.1** System shall support the roles: Parent/Guardian, Driver,
  Carpool Driver, Teacher, Gate Guard, Transport Coordinator, School Admin,
  Super Admin, with role-scoped permissions and UI.
- **FR-1.2** A guardian account may be linked to one or more students; a
  student may have multiple linked guardians.
- **FR-1.3** School Admin can onboard a school (routes, vehicles, staff,
  students) and bulk-import rosters (CSV import) **[ASSUMPTION: CSV import
  is the baseline bulk-onboarding mechanism, since no SIS integration was
  specified]**.
- **FR-1.4** Authentication via phone number + OTP for parent/driver/staff
  roles (low-friction, no password to forget); email/password or SSO
  acceptable for School Admin / Super Admin web dashboard
  **[ASSUMPTION]**.

### 1.2 Student Identity & QR
- **FR-2.1** Every enrolled student has a unique QR code, printed on ID
  card/badge, encoding an opaque, non-PII, rotatable token.
- **FR-2.2** System can regenerate/reissue a QR token (lost/damaged card)
  without breaking historical checkpoint records (old token invalidated,
  new token linked to same student record).
- **FR-2.3** QR must be scannable by standard phone camera via the app (no
  proprietary hardware reader required) at typical badge size (~3–5 cm).

### 1.3 Checkpoint Capture
- **FR-3.1** Driver app: scan student QR to record `bus_board` /
  `bus_alight` events, with automatic vehicle + route + timestamp +
  GPS-tagged location.
- **FR-3.2** Carpool mode: same scan flow, driver's own vehicle is
  implicitly the "vehicle," designed for a fast 5-second-per-child scan
  flow with no additional hardware.
- **FR-3.3** Gate checkpoint: Teacher/Gate Guard app can scan QR for
  `gate_in` / `gate_out`; alternatively, ingest equivalent events from an
  existing school biometric/RFID gate system via the Integration Adapter.
- **FR-3.4** Classroom checkpoint (optional per school): ingest from
  school's existing digital attendance system, or manual QR scan by
  teacher for `classroom_in` / `classroom_out`.
- **FR-3.5** All checkpoint events are validated against the day's roster
  (expected student/vehicle/route combination) before being accepted;
  invalid/unexpected scans are flagged, not silently dropped.
- **FR-3.6** Checkpoint capture must work while offline and sync when
  connectivity resumes, without losing or reordering events (see
  Architecture §7).
- **FR-3.7** A parent or admin can mark a student "not traveling
  today"/absent to suppress missed-checkpoint escalations for that day.

### 1.4 Live Vehicle Tracking
- **FR-4.1** Driver/carpool app streams GPS location while a trip is
  active (start/end trip explicitly, or auto-detected from first/last
  scan of the day **[ASSUMPTION: explicit start/end trip control by
  driver, to bound battery/data usage and give a clear trip boundary]**).
- **FR-4.2** Parent app displays live vehicle location on a map, with ETA
  to the student's stop/school.
- **FR-4.3** System computes and pushes an "approaching" alert when the
  vehicle enters a configurable radius/geofence around the student's
  registered pickup/drop point.

### 1.5 Notifications
- **FR-5.1** Push + SMS notification at each checkpoint event
  (board/alight/gate/classroom), templated and near-real-time (< 60s from
  event to delivery attempt — see NFR-2).
- **FR-5.2** Driver/carpool driver can broadcast a one-tap "running late"
  notification to all guardians on the current route.
- **FR-5.3** School Admin can send a bulk alert to all guardians on one or
  more routes (e.g., system-wide delay).
- **FR-5.4** Notification channel fallback: if push delivery fails/unseen
  within a short window, fall back to SMS for anything
  escalation-related.
- **FR-5.5** Users can manage notification channel preferences
  (push/SMS/voice) per alert category, except that escalation alerts
  cannot be fully disabled below a minimum severity **[ASSUMPTION: safety
  alerts are not fully mutable by end users]**.

### 1.6 Expected-Time Windows & Escalation
- **FR-6.1** School Admin/Transport Coordinator can configure an expected
  time window (start, end, tolerance) per checkpoint type per
  route/student.
- **FR-6.2** System detects a missed checkpoint (no matching event by
  `window_end + tolerance`) and raises an escalation.
- **FR-6.3** Escalation follows a configurable, ordered chain (default:
  Parent → Transport Coordinator → School Admin → Police/Emergency
  contact), with configurable per-step delay before advancing.
- **FR-6.4** Any human in the chain can acknowledge/resolve an escalation
  (e.g., "found the student, false alarm") to stop further escalation.
- **FR-6.5** The final "contact police" step requires an explicit
  human-triggered action in the admin/coordinator UI (one-tap
  call/dispatch) rather than being placed automatically by the system —
  see Architecture §4.7 / Assumption A9. **This is flagged for explicit
  stakeholder/legal sign-off**, since the source description says
  "escalate... to police by phone call" without specifying human-in-the-
  loop vs. fully automated.
- **FR-6.6** All escalation activity (who/when/what channel/outcome) is
  logged and visible to School Admin.

### 1.7 School Admin Dashboard
- **FR-7.1** Real-time roster view: per route/vehicle, which students have
  checked in/out at each checkpoint today, and who has not.
- **FR-7.2** Fleet map view: all active vehicles' live locations.
- **FR-7.3** Escalation queue: open/acknowledged/resolved escalations,
  filterable by route/school/severity.
- **FR-7.4** Route/vehicle/roster CRUD, staff and driver assignment.
- **FR-7.5** Historical reports: on-time performance, escalation
  frequency, per-route punctuality — **[ASSUMPTION: basic reporting is
  in scope for v1; advanced analytics/BI is a later phase]**.

### 1.8 Integration
- **FR-8.1** Adapter layer to ingest checkpoint-equivalent events from an
  existing school gate/biometric attendance system: webhook push
  (HMAC-signed) preferred; for systems on the school's local network, a
  pull through **Cloudflare Tunnel** run on a small on-site machine, so no
  inbound firewall ports are opened at the school; scheduled batch/SFTP
  import over the same Tunnel as a last resort.
- **FR-8.2** Adapter layer to ingest classroom attendance from an existing
  school digital-attendance system, where present.

## 2. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Availability | Core checkpoint-ingestion and notification path: ≥ 99.9% monthly uptime target (this is a safety-critical path). The path runs entirely on Cloudflare (Workers, Durable Objects, Queues, D1), so this target depends on those services' availability; see Architecture §9 (A15). |
| NFR-2 | Latency | Checkpoint scan → parent notification dispatch: p95 < 60 seconds under normal connectivity. |
| NFR-3 | Latency | Live GPS position update to parent map: p95 < 10 seconds end-to-end. |
| NFR-4 | Scalability | Support O(10,000) concurrent active vehicle trips and O(100,000) concurrent parent-app map viewers per region at launch scale **[ASSUMPTION — no target scale was given; sized for "district-wide, multi-school rollout" rather than single-school pilot]**. Met by sharding hot state across Durable Objects (one per school, one per vehicle) and hibernating WebSockets, not by adding servers. |
| NFR-5 | Resilience | No checkpoint event or escalation is lost due to a transient network/service failure: transactional Durable Object storage, alarms retried by the platform until they succeed, Cloudflare Queues with at-least-once delivery and a dead-letter queue, and idempotent D1 writes keyed on client UUIDs. |
| NFR-6 | Offline support | Driver/staff apps must queue and later sync scans/pings captured while offline, without event loss or reordering (client UUID + client timestamp). |
| NFR-7 | Security | All data in transit encrypted (TLS 1.2+, terminated at Cloudflare's edge); data at rest encrypted (Cloudflare encrypts D1, Durable Object storage and R2). No origin servers or open inbound ports. Abuse protection by WAF rate limiting rules, the Workers Rate Limiting API and Turnstile on OTP requests. |
| NFR-8 | Privacy | QR tokens contain no PII; RBAC scoping enforced server-side on every query, not just UI-hidden. |
| NFR-9 | Compliance | Design supports compliance with India's Digital Personal Data Protection Act, 2023 (minor's data, guardian consent, data localization) — final compliance posture requires legal review. D1, Durable Objects and R2 offer an Asia-Pacific location hint but no India-only jurisdiction, so India-only storage cannot be guaranteed (Architecture A14, open question 6). |
| NFR-10 | Auditability | Every checkpoint, notification, and escalation step is immutably logged with actor, timestamp, and outcome. |
| NFR-11 | Usability | Checkpoint scan flow must complete in ≤ 5 seconds per student (explicit product requirement for carpool flow, applied as the target for all scan flows). |
| NFR-12 | Device support | Driver/staff apps must run acceptably on low-to-mid-range Android devices (assume Android is the dominant OS among drivers/staff in target market) **[ASSUMPTION]**; parent app supports iOS + Android. |
| NFR-13 | Localization | UI supports English + at least one regional language (e.g., Hindi) at launch **[ASSUMPTION, given Delhi/India market reference]**; architecture should support adding more without redeploys (externalized string resources). |
| NFR-14 | Battery/data | Driver app GPS streaming must be tunable (interval, accuracy mode) to balance live-tracking fidelity against device battery and mobile-data cost. |
| NFR-15 | Observability | Structured logs (Workers Logs, retained via Logpush to R2), metrics (Workers Analytics Engine) and error tracking (Sentry) across all Workers and Durable Objects; a watchdog Cron Trigger pages on-call within 2 minutes if any school's escalation alarm runs late or notification queue lag exceeds bounds. |

## 3. Confirmed & Recommended Technology Stack

The stack below reflects the team's **confirmed choices** (marked
**[DECIDED]**) plus recommendations for the pieces left open (marked
**[RECOMMENDATION]** or **[ASSUMPTION]**). The backend is
**Cloudflare-native**: Workers, Durable Objects, D1, R2, Queues, KV,
Tunnel and Cloudflare's rate limiting, with no servers, containers or
clusters to operate (Architecture §1, §3).

### 3.1 Mobile Apps (Parent, Driver/Carpool, Staff)
- **Framework `[DECIDED]`:** **React Native with Expo** (managed workflow,
  or Expo with a custom dev client if a native module requires it) —
  single codebase across iOS/Android, role-based navigation for the four
  client surfaces described in Architecture §2.
- **QR scanning `[DECIDED]`:** `react-native-vision-camera` (its built-in
  code scanner) for fast, reliable QR decode including low light/motion
  (bus environment). This requires a **custom dev client / EAS Build**
  (`expo-dev-client`) rather than Expo Go, since `vision-camera` includes
  native code — plan the build pipeline (EAS Build) accordingly.
- **QR generation (server-side) `[DECIDED]`:** `qrcode` (in its SVG/string
  mode) renders the printable ID-card sheet inside the `api` Worker, with
  the Workers `nodejs_compat` flag if needed (Student & QR Service,
  Architecture §4.2). Generated sheets are cached in R2.
- **Maps `[DECIDED]`:** **Google Maps SDK** via `react-native-maps`
  (`PROVIDER_GOOGLE`) — best India road/address coverage for the live
  vehicle map and ETA.
- **Background location:** platform-appropriate foreground-service /
  background-location APIs (Android foreground service with persistent
  notification while a trip is active, to comply with Android background
  location restrictions and to be transparent to the driver that tracking
  is on). With Expo: `expo-location`'s background location task, built via
  EAS (not compatible with Expo Go for background tasks either).
- **Offline storage/queue:** `expo-sqlite` for queued scans/pings, with a
  lightweight sync-queue table + background sync worker
  (`expo-task-manager` / `expo-background-fetch`) — **[ASSUMPTION]** picked
  for Expo compatibility in place of `WatermelonDB`.
- **Push notifications `[DECIDED]`:** **Firebase Cloud Messaging (FCM)**
  — client-side via `@react-native-firebase/messaging` (Expo config plugin
  + EAS Build), with FCM's built-in relay to APNs for iOS so a single
  integration covers both platforms. See §3.5 for the backend side.
- **State/data layer `[DECIDED]`:** **RTK Query** (Redux Toolkit) for REST
  data-fetching/caching in all mobile apps and the admin dashboard. Live
  map and live alerts use the platform's native `WebSocket` (the backend
  serves WebSockets from Durable Objects, not Socket.IO); RTK Query's
  `onCacheEntryAdded` can bridge the WebSocket stream into the Redux
  store.

### 3.2 School Admin / Coordinator Web Dashboard
- **Framework `[DECIDED]`:** **React with Next.js** — a data-dense,
  real-time dashboard (roster tables, fleet map, escalation queue).
- **Hosting `[DECIDED]`:** deployed to **Cloudflare Workers** with the
  **OpenNext Cloudflare adapter** (`@opennextjs/cloudflare`). It calls the
  `api` Worker through a service binding (an internal call, not a trip
  over the public internet).
- **Data layer `[DECIDED]`:** **RTK Query**, consistent with the mobile
  apps.
- **Map:** Google Maps JavaScript API (consistent with the mobile apps).
- **Real-time updates:** native `WebSocket` to the school's `SchoolDO`
  (live roster, fleet board, escalation queue).
- **Charts/reporting:** a standard charting lib (e.g. Recharts/ECharts)
  for on-time-performance / escalation-frequency reports.

### 3.3 Backend Services
- **Runtime `[DECIDED]`:** **Cloudflare Workers**, TypeScript. Workers run
  on V8 isolates with Web-standard APIs (`fetch`, WebCrypto, WebSocket)
  and an optional Node.js compatibility layer (`nodejs_compat`). This
  replaces Node.js on GKE.
- **Framework `[RECOMMENDATION]`:** **Hono** — a small router built for
  Workers, with middleware for auth and validation and optional OpenAPI
  generation (`@hono/zod-openapi`). **Needs team confirmation.**
- **Workers `[DECIDED]`:**
  - `api`: REST BFF, auth, rate limiting, WebSocket upgrade routing to
    Durable Objects.
  - `admin`: the Next.js dashboard (§3.2).
  - `integrations`: school gate/attendance adapter (§3.6, Tunnel).
  - `notify`: Queue consumer for push/SMS/voice.
  - `watchdog`: Cron Trigger every minute.
- **Stateful coordination `[DECIDED]`:** **Durable Objects** with
  SQLite-backed storage, alarms and the WebSocket Hibernation API:
  - `SchoolDO`, addressed by school ID: today's expected checkpoints,
    checkpoint ingestion, the escalation state machine, the live roster
    and fleet board.
  - `VehicleDO`, addressed by vehicle ID: GPS ingestion, ETA, geofences,
    parent live-map fan-out, trip GPS buffer.
  - Both are created with an Asia-Pacific location hint (Architecture
    A14).
- **Timers `[DECIDED]`:** **Durable Object alarms** replace BullMQ/Temporal
  for expected-window deadlines and escalation-step delays. Each object
  keeps one alarm set to its earliest due item; the platform retries the
  alarm handler until it succeeds, so handlers are idempotent.
- **Event bus `[DECIDED]`:** **Cloudflare Queues** replace Kafka:
  `checkpoint-events`, `escalation-events`, `notifications`, each with a
  dead-letter queue. Consumers are idempotent (at-least-once delivery).
  Replay for audit comes from D1 and the R2 archive rather than from
  broker retention.
- **Scheduled jobs:** **Cron Triggers** for the `watchdog`, nightly D1
  exports to R2, retention purges, and batch integration pulls.
- **API style:** REST/JSON (OpenAPI-documented) for CRUD; WebSocket for
  live location and live alerts; Workers **service bindings** and Durable
  Object RPC for internal calls (no internal HTTP endpoints exposed).
- **Rate limiting `[DECIDED]`:** three layers — **WAF rate limiting rules**
  at the edge (per IP: OTP, login, scan and location endpoints), the
  **Workers Rate Limiting API** in code (per phone number, per user, per
  device), and **Turnstile** on OTP requests.

### 3.4 Data Stores
- **Relational database `[DECIDED]`:** **Cloudflare D1** (SQLite):
  - one **control** database: users, school registry, devices, OTP codes,
    refresh tokens;
  - **one database per school**: students, QR tokens, guardians, vehicles,
    routes, stops, rosters, windows, checkpoint history, escalations,
    notifications (Architecture A2).
  - Access through **Drizzle ORM** (supports D1) for typed queries and
    migrations **[RECOMMENDATION]**; migrations are fanned out to every
    school database by a deploy script.
  - **D1 read replication** for heavy report queries; **D1 Time Travel**
    for point-in-time restore of any school database.
  - Free-text search (large rosters/logs) uses SQLite **FTS5** inside D1
    rather than a separate search service.
- **Hot operational state `[DECIDED]`:** **Durable Object storage**
  (transactional, strongly consistent) for today's plans, open
  escalations, latest vehicle positions and the current trip's GPS buffer.
- **Object storage `[DECIDED]`:** **Cloudflare R2**, accessed from Workers
  through bindings (no access keys inside the application):
  - GPS trip archives (one compressed file per trip; GPS points never go
    into D1);
  - CSV roster imports and report exports;
  - printable QR/ID-card sheets;
  - nightly D1 exports (long-term backup beyond Time Travel);
  - Workers logs via Logpush.
  - Lifecycle rules expire each prefix per the retention policy (A13).
  - External tools use R2's S3-compatible API. (**Naming note:** the
    team's "Cloudflare S3" is taken to mean **R2**, Cloudflare's
    S3-compatible object storage.)
- **Key-value cache:** **Workers KV** for read-mostly configuration and
  the cached FCM OAuth token. KV is eventually consistent, so nothing
  auth- or safety-related is stored there.
- **Not used:** PostgreSQL/PostGIS (geofences are plain distance math over
  a route's stops, inside `VehicleDO`), TimescaleDB (GPS lives in
  `VehicleDO` storage, then R2), Redis (replaced by Durable Objects),
  OpenSearch (FTS5 is enough).

### 3.5 Third-Party / External Services

- **Push notifications `[DECIDED]`:** **Firebase Cloud Messaging (FCM)**,
  used directly — the team's final call after weighing OneSignal
  (third-party wrapper, adds a data processor for a child-safety product)
  and Novu (self-hosted multi-channel orchestration, but a younger/less-
  proven project) against going straight to the source.
  - **Backend:** the `notify` Worker calls FCM's **HTTP v1 REST API**
    directly. The Firebase Admin SDK is not used because it depends on
    Node.js APIs the Workers runtime doesn't provide. The Worker signs a
    service-account JWT with WebCrypto, exchanges it for a Google OAuth
    access token, and caches that token in KV until shortly before it
    expires. FCM is free at any volume.
  - **Client:** `@react-native-firebase/messaging` in all mobile apps,
    registering device tokens with the backend on login/app-open.
  - **Why FCM covers both platforms:** FCM relays to APNs for iOS, so one
    integration reaches Android and iOS.
  - **What FCM does *not* give you** (unlike OneSignal): audience
    segmentation, delivery-rate dashboards, A/B testing, scheduled
    campaigns. The `notify` Worker therefore records `sent` / `delivered`
    / `failed` per notification in the school's D1 database (FR-5.1,
    NFR-15), since "did the push arrive" matters on a safety-critical
    path.
  - Push delivery failures fall back to SMS per FR-5.4.
  - **Note for the record:** on Android, FCM *is* the OS-level transport
    for background push — no vendor wrapper avoids depending on it; going
    direct is the same transport with one fewer vendor and one fewer data
    processor in the path, which matters for the DPDP review (A12).
- **SMS & voice (India-first):** **MSG91**, **Exotel**, or **Kaleyra**
  (India-focused providers with good deliverability and DLT-registration
  support, which is a **regulatory requirement for commercial SMS in
  India**); **Twilio** as a global-fallback/alternative. Called from the
  `notify` Worker over their HTTP APIs.
  **[ASSUMPTION/NOTE: Indian SMS regulations require DLT (Distributed
  Ledger Technology) template registration for any transactional/
  promotional SMS — this is an operational/compliance task, not just a
  vendor choice.]**
- **Maps/geocoding `[DECIDED]`:** **Google Maps Platform** (Maps SDK,
  Geocoding, Directions/Routes APIs) — best road/address coverage for
  Indian cities, consistent choice across mobile apps and admin
  dashboard. Server-side calls, if any, are made from Workers over HTTPS.
- **Emergency/police escalation:** no verified public dispatch API assumed
  to exist for this market; v1 implements this as a human-triggered
  phone call / local emergency-contact workflow (Architecture A9), not an
  automated API integration. If a city/state emergency-dispatch API
  becomes available it can be added as another channel in the `notify`
  Worker.

### 3.6 Infrastructure & DevOps
- **Platform `[DECIDED]`:** **Cloudflare**, on the **Workers Paid** plan
  (Durable Objects, Queues and D1 at production limits). Replaces GCP,
  GKE and the earlier GCP-plus-R2 multi-cloud split.
- **Edge security `[DECIDED]`:** WAF managed rules and **rate limiting
  rules**, **Turnstile** on OTP requests, TLS terminated at the edge.
- **Cloudflare Tunnel `[DECIDED]`:** connects the `integrations` Worker to
  school gate/attendance systems on school networks via `cloudflared` on
  a small on-site machine, with no inbound ports opened at the school;
  protected by **Cloudflare Access** service tokens (FR-8.1).
- **Cloudflare Access:** internal tools (super-admin console, support
  views) behind the team's identity provider.
- **CI/CD:** GitHub Actions with **Wrangler**: deploy Workers and Durable
  Object classes, create Queues, apply D1 migrations (control database
  first, then every school database), with separate staging and
  production environments. Mobile builds via **EAS Build** (Expo
  Application Services), since `vision-camera` and background location
  need custom native builds.
- **IaC:** Wrangler configuration for Worker-level resources (bindings,
  Durable Objects, Queues, Cron Triggers); **Terraform's Cloudflare
  provider** for account-level resources (DNS, WAF and rate limiting
  rules, Turnstile widgets, Access applications, Tunnels, R2 buckets and
  lifecycle rules).
- **Monitoring/observability:** **Workers Logs** (Logpush to R2 for
  retention), **Workers Analytics Engine** for metrics (scan rate, alarm
  lag, queue lag, notification latency), **Sentry** (`@sentry/cloudflare`
  for Workers, `@sentry/react-native` for the apps), the **`watchdog`
  Worker** paging on-call if any school's alarm runs late or queue lag
  grows, and Cloudflare Notifications for platform incidents. Silent
  failures are unacceptable on this safety-critical path.
- **Secrets management `[DECIDED]`:** **Workers secrets** (or Cloudflare
  Secrets Store for secrets shared across Workers) for the FCM service
  account, SMS provider keys, JWT signing key and per-school HMAC
  secrets. Nothing sensitive in code or configuration files.

### 3.7 Testing
- **Backend:** **Vitest** with **`@cloudflare/vitest-pool-workers`**, which
  runs tests inside the Workers runtime with local D1, Durable Objects
  (including alarms), Queues, R2 and KV; contract tests for the API
  (OpenAPI-driven).
- **Escalation engine:** deterministic tests that drive a `SchoolDO`
  through a simulated school day (missed scans, a late bus, an absent
  student, a late offline sync, an acknowledgement) and assert every
  escalation opens, advances and resolves at the right minute.
- **Mobile:** component/unit tests (Jest + React Native Testing Library),
  E2E tests (**Detox**, or **Maestro** which works well with Expo/EAS
  builds) especially for the scan-flow and offline-sync paths, since those
  are safety-critical.
- **Admin dashboard:** component tests (Jest + React Testing Library),
  E2E (Playwright or Cypress) for the roster/escalation-queue flows.
- **Load testing:** k6 against a staging environment, sized to NFR-4
  (location ingestion, WebSocket fan-out, gate-rush scan bursts per
  `SchoolDO`). Workers bill per request, so budget the test runs.
- **Chaos/resilience testing:** verify NFR-5/NFR-6 (no lost events) when
  a Durable Object is restarted mid-escalation (the alarm must re-fire and
  the handler stay idempotent), a Queue consumer fails repeatedly (events
  reach the dead-letter queue and alert), and events are delivered twice.

## 4. External Integrations Summary

| Integration | Purpose | Notes |
|---|---|---|
| School biometric/RFID gate systems | Auto-capture gate_in/gate_out | `integrations` Worker; HMAC-signed webhook preferred, or pull over **Cloudflare Tunnel** for systems on the school network, batch/SFTP over the same Tunnel as fallback |
| School digital attendance systems | Auto-capture classroom_in/out | Same adapter pattern; optional per school |
| Firebase Cloud Messaging (FCM) | Push notifications | Free, relays to APNs for iOS; called via HTTP v1 REST from Workers (no Admin SDK); no built-in delivery dashboard — see §3.5 |
| SMS/Voice gateway (MSG91/Exotel/Twilio) | SMS + voice notifications, escalation | DLT template registration required in India |
| Google Maps Platform | Live map, geocoding, ETA | Usage-based pricing — monitor at scale |
| Cloudflare platform | Workers, Durable Objects, D1, R2, Queues, KV, Tunnel, Access, WAF rate limiting, Turnstile | The whole backend; single vendor by design (Architecture A15); no India-only data location (A14) |
| (Future) Emergency dispatch API | Automated police escalation | Not assumed available; v1 is human-triggered |

## 5. Assumptions Log (consolidated)

All assumptions made while translating the product description into
requirements, for stakeholder review:

1. One multi-role codebase, role-gated UI, not separate products
   (Architecture A1).
2. School-level multi-tenancy with **one D1 database per school** plus a
   shared control database, replacing the earlier shared-database design
   (A2).
3. A single `api` Worker is the BFF for REST and WebSocket upgrades, which
   it hands to the owning Durable Object (A3).
4. A guardian may have students across multiple schools (A4) — **needs
   confirmation**. The identity is global (control database); links live
   in each school's database.
5. QR token is opaque/non-PII, not a direct identity payload (A5).
6. GPS ping interval ~5–10s while trip active, tunable (A7).
7. Expected-time windows are admin-configured (static) for v1; adaptive
   learning is a later phase (A8).
8. Police escalation step is human-triggered, not fully automated (A9) —
   **flagged for legal/liability sign-off**.
9. Integration Adapter supports webhook, Tunnel pull and batch ingestion,
   since target schools' existing systems vary (A10).
10. Offline queue + sync is a hard requirement for driver/staff apps given
    real-world connectivity gaps on routes (A11).
11. India DPDP Act 2023 applies; parental consent flow and a data
    protection contact are required (A12) — **needs legal review**.
12. Data retention period is a policy decision to be set per school
    contract, not fixed by engineering (A13).
13. Stateful services (Durable Objects, D1, R2) use an **Asia-Pacific
    location hint**; Cloudflare offers no India-only jurisdiction for
    them, so India-only storage cannot be guaranteed (A14) — **needs
    legal review before the first contract**.
14. CSV bulk-import is the v1 mechanism for roster onboarding, no SIS
    integration assumed (FR-1.3).
15. Explicit driver-initiated trip start/end bounds GPS streaming,
    rather than always-on tracking (FR-4.1).
16. Android is the primary target for driver/staff devices; parent app
    supports both iOS and Android (NFR-12).
17. Launch scale sized for multi-school/district rollout, not a single
    pilot school, in absence of a stated target (NFR-4).
18. English + Hindi localization at launch (NFR-13).
19. "Cloudflare S3" (as specified by the team) is interpreted as
    **Cloudflare R2**, Cloudflare's S3-compatible object storage (§3.4).
20. Push notifications use **Firebase Cloud Messaging (FCM) directly**
    (team decision, §3.5), after comparing it against OneSignal and Novu
    — going direct trades away OneSignal's built-in delivery-analytics
    dashboard, which the `notify` Worker compensates for by tracking its
    own sent/delivered/failed state (FR-5.1, NFR-15).
21. The backend is **single-vendor (Cloudflare)** by design, replacing the
    earlier GCP-plus-R2 multi-cloud setup. A Cloudflare incident on
    Workers, Durable Objects or D1 is a full outage of the safety path;
    accepted in exchange for having no infrastructure to operate
    (Architecture A15).
22. **Hono** is recommended as the Workers framework — **needs team
    confirmation**; plain Workers routing is an equally valid choice.
23. **Cloudflare Queues** replace Kafka. Audit replay comes from D1 and
    R2 archives rather than broker retention.
24. **Durable Object alarms** replace BullMQ/Temporal for all deadline and
    escalation timers; alarm handlers are idempotent because the platform
    retries them.
25. FCM is called through its HTTP v1 REST API because the Firebase Admin
    SDK doesn't run on Workers (§3.5).
26. GPS points are never stored in D1: they're buffered in `VehicleDO`
    storage and archived to R2 per trip.
27. Cloudflare platform limits (D1 database size, Durable Object
    throughput, Queues throughput) quoted in the architecture are
    approximate and must be checked against current documentation before
    district-scale rollout (Architecture open question 7).

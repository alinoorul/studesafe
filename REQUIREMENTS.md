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
  existing school gate/biometric attendance system (webhook push
  preferred; scheduled batch pull as fallback).
- **FR-8.2** Adapter layer to ingest classroom attendance from an existing
  school digital-attendance system, where present.

## 2. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Availability | Core checkpoint-ingestion and notification path: ≥ 99.9% monthly uptime target (this is a safety-critical path). |
| NFR-2 | Latency | Checkpoint scan → parent notification dispatch: p95 < 60 seconds under normal connectivity. |
| NFR-3 | Latency | Live GPS position update to parent map: p95 < 10 seconds end-to-end. |
| NFR-4 | Scalability | Support O(10,000) concurrent active vehicle trips and O(100,000) concurrent parent-app map viewers per region at launch scale **[ASSUMPTION — no target scale was given; sized for "district-wide, multi-school rollout" rather than single-school pilot]**. |
| NFR-5 | Resilience | No checkpoint event or escalation is lost due to a transient network/service failure (at-least-once delivery + idempotent processing via event bus + dedup keys). |
| NFR-6 | Offline support | Driver/staff apps must queue and later sync scans/pings captured while offline, without event loss or reordering (client UUID + client timestamp). |
| NFR-7 | Security | All data in transit encrypted (TLS 1.2+); sensitive data at rest encrypted (DB-level encryption + encrypted object storage). |
| NFR-8 | Privacy | QR tokens contain no PII; RBAC scoping enforced server-side on every query, not just UI-hidden. |
| NFR-9 | Compliance | Design supports compliance with India's Digital Personal Data Protection Act, 2023 (minor's data, guardian consent, data localization) — final compliance posture requires legal review. |
| NFR-10 | Auditability | Every checkpoint, notification, and escalation step is immutably logged with actor, timestamp, and outcome. |
| NFR-11 | Usability | Checkpoint scan flow must complete in ≤ 5 seconds per student (explicit product requirement for carpool flow, applied as the target for all scan flows). |
| NFR-12 | Device support | Driver/staff apps must run acceptably on low-to-mid-range Android devices (assume Android is the dominant OS among drivers/staff in target market) **[ASSUMPTION]**; parent app supports iOS + Android. |
| NFR-13 | Localization | UI supports English + at least one regional language (e.g., Hindi) at launch **[ASSUMPTION, given Delhi/India market reference]**; architecture should support adding more without redeploys (externalized string resources). |
| NFR-14 | Battery/data | Driver app GPS streaming must be tunable (interval, accuracy mode) to balance live-tracking fidelity against device battery and mobile-data cost. |
| NFR-15 | Observability | All backend services expose health checks, structured logs, and metrics; end-to-end tracing across the checkpoint→notification and ping→map paths. |

## 3. Confirmed & Recommended Technology Stack

The stack below reflects the team's **confirmed choices** (marked
**[DECIDED]**) plus recommendations for the pieces the brief left open
(marked **[RECOMMENDATION]** or **[ASSUMPTION]**). One item — object
storage vendor naming — needed a decision call and is explained inline.

### 3.1 Mobile Apps (Parent, Driver/Carpool, Staff)
- **Framework `[DECIDED]`:** **React Native with Expo** (managed workflow,
  or Expo with a custom dev client if a native module requires it) —
  single codebase across iOS/Android, role-based navigation for the four
  client surfaces described in Architecture §2.
- **QR scanning `[DECIDED]`:** `react-native-vision-camera` +
  `vision-camera-code-scanner` for fast, reliable QR decode including low
  light/motion (bus environment). Note: as of recent Expo SDKs this
  requires a **custom dev client / EAS Build** (`expo-dev-client`) rather
  than the classic Expo Go managed workflow, since `vision-camera`
  includes native code — plan the build pipeline (EAS Build) accordingly
  rather than Expo Go for internal testing on driver/staff devices.
- **QR generation (server-side) `[DECIDED]`:** `qrcode` (Node package) to
  render the printable ID-card artifact, run from the Node.js backend
  (Student & QR Service, Architecture §4.2).
- **Maps `[DECIDED]`:** **Google Maps SDK** via `react-native-maps`
  (`PROVIDER_GOOGLE`) — best India road/address coverage for the live
  vehicle map and ETA.
- **Background location:** platform-appropriate foreground-service /
  background-location APIs (Android foreground service with persistent
  notification while a trip is active, to comply with Android background
  location restrictions and to be transparent to the driver that tracking
  is on). With Expo: `expo-location`'s background location task, built via
  EAS (not compatible with Expo Go for background tasks either).
- **Offline storage/queue:** `expo-sqlite` (Expo-compatible SQLite) for
  queued scans/pings, with a lightweight sync-queue table + background
  sync worker (`expo-task-manager` / `expo-background-fetch`) —
  **[ASSUMPTION]** picked for Expo-managed-workflow compatibility in place
  of `WatermelonDB` (which needs a fuller native/bare setup).
- **Push notifications `[DECIDED]`:** **Firebase Cloud Messaging (FCM)**
  — client-side via `@react-native-firebase/messaging` (works with Expo
  via a config plugin + EAS Build; not available in Expo Go, consistent
  with the custom-dev-client requirement already driven by
  `vision-camera` above) for Android, with FCM's built-in relay to APNs
  for iOS so a single integration covers both platforms. See §3.5 for the
  backend/provider side.
- **State/data layer `[DECIDED]`:** **RTK Query** (Redux Toolkit) for REST
  data-fetching/caching in all three mobile apps and the admin dashboard;
  a plain WebSocket client (native `WebSocket` or `socket.io-client`,
  matched to whatever the backend Gateway uses — see §3.3) for the live
  map / live-alert push channel, since that's a streaming concern RTK
  Query isn't designed for (RTK Query's `onCacheEntryAdded` can bridge a
  WebSocket subscription into the Redux store if a single unified data
  layer is preferred).

### 3.2 School Admin / Coordinator Web Dashboard
- **Framework `[DECIDED]`:** **React with Next.js** — a data-dense,
  real-time dashboard (roster tables, fleet map, escalation queue).
- **Data layer `[DECIDED]`:** **RTK Query**, consistent with the mobile
  apps, so query/cache/invalidation logic (and generated API types, if
  driven off the backend's OpenAPI schema) is shared across all four
  client surfaces.
- **Map:** Google Maps JS SDK (consistent with the mobile apps' Google
  Maps SDK choice).
- **Real-time updates:** WebSocket client (native `WebSocket` or
  `socket.io-client`) subscribed to fleet/escalation channels.
- **Charts/reporting:** a standard charting lib (e.g. Recharts/ECharts)
  for on-time-performance / escalation-frequency reports.

### 3.3 Backend Services
- **Language/runtime `[DECIDED]`:** **Node.js**, for all backend services
  in Architecture §4.
  - **Framework `[RECOMMENDATION]`:** **NestJS (TypeScript)** on top of
    Node — the brief specified the runtime, not the framework; NestJS is
    recommended because it shares TS types/tooling with the Next.js
    admin dashboard and RTK-Query-based clients, gives strong support for
    modular service boundaries (matches the service breakdown in
    Architecture §4), and has good native WebSocket/Gateway support for
    the live-location and live-alert channels. A lighter Express/Fastify
    setup is a reasonable alternative if the team prefers less framework
    convention; flagging for team confirmation rather than assuming.
- **API style:** REST (OpenAPI-documented) for CRUD; WebSocket (Socket.IO
  or native `ws`, whichever pairs better with the RTK Query
  `onCacheEntryAdded` bridge chosen client-side) for live location + live
  alert push; gRPC optionally for internal service-to-service calls if the
  team wants strict contracts (not required for v1).
- **API Gateway / BFF:** a Node/NestJS gateway module (consistent with the
  rest of the backend) handling authN/Z, rate limiting, and routing to
  internal services; Kong or GCP API Gateway/Apigee are viable if the team
  prefers an off-the-shelf gateway in front of GKE instead.
- **Event bus `[DECIDED]`:** **Apache Kafka** — durable, replayable, and a
  good fit for the audit/event-sourced design in Architecture §4.4/§4.10
  (checkpoint events, location pings, escalation state changes all flow
  through it). Given the team is already committed to Kubernetes (§3.6),
  run Kafka either via a managed offering (e.g. **Confluent Cloud** or
  **Google Cloud Managed Service for Apache Kafka**) or self-hosted on GKE
  with the **Strimzi Kafka Operator** — managed is recommended for v1 to
  avoid taking on Kafka/ZooKeeper-or-KRaft operational burden before the
  team has production experience running it.
- **Scheduler / delayed jobs (for expected-window timers,
  escalation-step delays):** **BullMQ** (Redis-backed, native to the
  Node/Redis stack already in use) is the default recommendation; consider
  **Temporal.io** later if the multi-step, resumable, human-acknowledged
  escalation workflow (Architecture §4.7) outgrows what BullMQ's simple
  delayed-job model comfortably expresses.

### 3.4 Data Stores
- **Primary OLTP database:** **PostgreSQL** with the **PostGIS** extension
  (geofencing, spatial queries for "nearest stop," "within geofence").
- **Time-series store for location pings:** PostgreSQL +
  **TimescaleDB** extension (keeps location history in the same
  ecosystem as the relational data) or a dedicated store
  (InfluxDB/Amazon Timestream) if ping volume outgrows Postgres/Timescale
  comfortably.
- **Cache / hot-path store:** **Redis** — latest vehicle position,
  pub/sub fan-out to WebSocket gateway instances, rate limiting,
  session/token blacklisting.
- **Object storage `[DECIDED]`:** **Cloudflare R2** (S3-compatible object
  storage) for QR/ID-card images and any document uploads. **Naming
  note:** Cloudflare's product is called **R2**, not "Cloudflare S3" — it
  exposes an S3-compatible API, so existing S3 SDKs/tooling (`aws-sdk`,
  `@aws-sdk/client-s3`) work against it with an endpoint override; this
  doc assumes that's what was meant. R2's appeal is zero egress fees,
  which matters here since ID-card/QR images are served to mobile clients
  repeatedly. Operationally this makes the deployment **multi-cloud**
  (GKE/Postgres/Redis on GCP, object storage on Cloudflare) — see
  Architecture §9 / Assumption A15 for the tradeoff this introduces
  (separate IAM/credential surface, cross-cloud egress from GKE to R2).
- **Search (optional, later phase):** OpenSearch/Elasticsearch for
  admin-side free-text search across large rosters/logs, if needed beyond
  what Postgres full-text search handles.

### 3.5 Third-Party / External Services

- **Push notifications `[DECIDED]`:** **Firebase Cloud Messaging (FCM)**,
  used directly — the team's final call after weighing OneSignal
  (third-party wrapper, adds a data processor for a child-safety product)
  and Novu (self-hosted multi-channel orchestration, but a younger/less-
  proven project) against going straight to the source.
  - **Backend:** Notification Service calls the **Firebase Admin SDK**
    (Node.js) to send to device tokens/topics; FCM is free at any volume
    and requires no per-message vendor cost, unlike SMS/voice.
  - **Client:** `@react-native-firebase/messaging` in all three mobile
    apps (Parent, Driver/Carpool, Staff), registering device tokens with
    the backend on login/app-open.
  - **Why FCM covers both platforms:** FCM natively relays to APNs for
    iOS delivery, so one integration (one SDK, one Admin-SDK call site)
    reaches Android and iOS — no separate APNs certificate management
    needed in application code.
  - **What FCM does *not* give you out of the box** (unlike OneSignal):
    audience segmentation, delivery-rate dashboards, A/B testing, or
    scheduled campaigns. Since FR-5.3 (bulk "system-wide delay" alert)
    and NFR-15 (observability on the safety-critical notification path)
    both depend on knowing who a push actually reached, the Notification
    Service should track its own delivery state — record `sent` when the
    Admin SDK accepts the send, and `delivered`/`failed` from FCM's
    response/receipt data — rather than assuming a bare "send" call is
    sufficient. This is a real gap versus a dedicated push platform, and
    is called out so it isn't silently missed at build time.
  - Push delivery failures still fall back to SMS per FR-5.4, which is
    the main mitigation for FCM's lack of built-in delivery guarantees.
  - **Note for the record:** on Android, FCM *is* the OS-level transport
    for background push — no vendor wrapper (OneSignal, Novu, AWS SNS,
    etc.) avoids depending on it either, they just add a layer in front
    of the same thing. Going direct is therefore not a technical
    downgrade versus the alternatives discussed earlier — it's the same
    transport with one fewer vendor and one fewer data processor in the
    path, which matters for the DPDP compliance review already flagged
    in §5 (Assumption A12).
- **SMS & voice (India-first):** **MSG91**, **Exotel**, or **Kaleyra**
  (India-focused providers with good deliverability and DLT-registration
  support, which is a **regulatory requirement for commercial SMS in
  India**); **Twilio** as a global-fallback/alternative.
  **[ASSUMPTION/NOTE: Indian SMS regulations require DLT (Distributed
  Ledger Technology) template registration for any transactional/
  promotional SMS — this is an operational/compliance task, not just a
  vendor choice.]**
- **Maps/geocoding `[DECIDED]`:** **Google Maps Platform** (Maps SDK,
  Geocoding, Directions APIs) — best road/address coverage for Indian
  cities, consistent choice across mobile apps and admin dashboard.
- **Emergency/police escalation:** no verified public dispatch API assumed
  to exist for this market; v1 implements this as a human-triggered
  phone call / local emergency-contact workflow (Architecture A9), not an
  automated API integration. If a city/state emergency-dispatch API
  becomes available it can be added as an alternate `NotificationService`
  channel.

### 3.6 Infrastructure & DevOps
- **Cloud provider `[DECIDED]`:** **GCP**, deployed in the **`asia-south1`
  (Mumbai)** region for latency and data-residency reasons (Architecture
  A14). Object storage is the one deliberate exception — Cloudflare R2,
  per §3.4 — making this a multi-cloud deployment by choice.
- **Compute `[DECIDED]`:** Containerized services on **Kubernetes**, via
  **GKE** (Google Kubernetes Engine), preferably **GKE Autopilot** for v1
  to reduce node-management overhead until the team has reason to move to
  Standard mode for finer-grained control.
- **CI/CD:** GitHub Actions (build, test, lint, deploy pipelines per
  service + per mobile app); mobile builds via **EAS Build**
  (Expo Application Services) given the Expo choice in §3.1, since
  `vision-camera` and background-location require custom native builds
  rather than Expo Go.
- **IaC:** Terraform for GCP resources (GKE cluster, Cloud SQL/Memorystore
  if used, Secret Manager entries, IAM) plus the R2 bucket (Terraform's
  Cloudflare provider).
- **Monitoring/observability:** **Google Cloud Operations Suite**
  (Cloud Monitoring/Logging), which comes GKE-native, or self-managed
  **Prometheus + Grafana** (GKE supports **Google Managed Service for
  Prometheus** if the team wants Prometheus-compatible metrics without
  running its own Prometheus server); **OpenTelemetry** for tracing across
  the checkpoint→notification and ping→map paths; **Sentry** for mobile +
  backend error tracking — important given this is a safety-critical
  alerting product where silent failures are unacceptable.
- **Logging:** centralized structured logging via **Cloud Logging** (GCP-
  native) or self-hosted Loki + Grafana if the team prefers to keep
  logging outside GCP's managed stack.
- **Secrets management `[DECIDED]`:** **GCP Secret Manager**, referenced
  by GKE workloads (e.g. via the Secret Manager CSI driver or Workload
  Identity + client library) rather than plain Kubernetes Secrets for
  anything sensitive (DB credentials, Kafka credentials, Firebase Admin
  SDK service-account key, SMS provider API keys, R2 access keys).

### 3.7 Testing
- **Backend:** unit tests (Jest, for Node/NestJS), integration tests
  against a containerized Postgres/Redis/Kafka (Testcontainers), contract
  tests for the API (OpenAPI-driven).
- **Mobile:** component/unit tests (Jest + React Native Testing Library),
  E2E tests (**Detox**, or **Maestro** which works well with Expo/EAS
  builds) especially for the scan-flow and offline-sync paths, since those
  are safety-critical.
- **Admin dashboard:** component tests (Jest + React Testing Library),
  E2E (Playwright or Cypress) for the roster/escalation-queue flows.
- **Load testing:** k6 or Locust against Location Service ingestion
  and WebSocket fan-out, sized to NFR-4 targets.
- **Chaos/resilience testing:** verify NFR-5/NFR-6 (no lost events)
  under simulated network partition/service-restart scenarios — high
  priority given the product's core promise is "no silent failure."

## 4. External Integrations Summary

| Integration | Purpose | Notes |
|---|---|---|
| School biometric/RFID gate systems | Auto-capture gate_in/gate_out | Via Integration Adapter; protocol varies per vendor — webhook preferred, batch/SFTP fallback |
| School digital attendance systems | Auto-capture classroom_in/out | Same adapter pattern; optional per school |
| Firebase Cloud Messaging (FCM) | Push notifications | Free, relays to APNs for iOS too; no built-in delivery dashboard — see §3.5 |
| SMS/Voice gateway (MSG91/Exotel/Twilio) | SMS + voice notifications, escalation | DLT template registration required in India |
| Google Maps Platform | Live map, geocoding, ETA | Usage-based pricing — monitor at scale |
| Cloudflare R2 | Object storage (QR/ID-card images) | S3-compatible API; zero egress fees; introduces multi-cloud footprint alongside GCP |
| (Future) Emergency dispatch API | Automated police escalation | Not assumed available; v1 is human-triggered |

## 5. Assumptions Log (consolidated)

All assumptions made while translating the product description into
requirements, for stakeholder review:

1. One multi-role codebase, role-gated UI, not separate products
   (Architecture A1).
2. School-level multi-tenancy via shared DB + `school_id`, not
   per-tenant DB isolation (A2).
3. Single API Gateway/BFF for REST + WebSocket (A3).
4. A guardian may have students across multiple schools (A4) — **needs
   confirmation**.
5. QR token is opaque/non-PII, not a direct identity payload (A5).
6. GPS ping interval ~5–10s while trip active, tunable (A7).
7. Expected-time windows are admin-configured (static) for v1; adaptive
   learning is a later phase (A8).
8. Police escalation step is human-triggered, not fully automated (A9) —
   **flagged for legal/liability sign-off**.
9. Integration Adapter supports both webhook and batch ingestion,
   since target schools' existing systems vary (A10).
10. Offline queue + sync is a hard requirement for driver/staff apps given
    real-world connectivity gaps on routes (A11).
11. India DPDP Act 2023 applies; parental consent flow and a data
    protection contact are required (A12) — **needs legal review**.
12. Data retention period is a policy decision to be set per school
    contract, not fixed by engineering (A13).
13. Primary deployment region is India (A14).
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
    **Cloudflare R2** — Cloudflare has no product literally named "S3";
    R2 is its S3-API-compatible object storage offering (§3.4).
    **Please confirm this interpretation is correct.**
20. Push notifications use **Firebase Cloud Messaging (FCM) directly**
    (team decision, §3.5), after comparing it against OneSignal and Novu
    — going direct trades away OneSignal's built-in delivery-analytics
    dashboard, which the Notification Service should compensate for by
    tracking its own sent/delivered/failed state per §3.5 (FR-5.1,
    NFR-15), since "did the push arrive" matters on a safety-critical
    path.
21. Choosing Cloudflare R2 for object storage while the rest of the stack
    is GCP (§3.6) makes the deployment intentionally multi-cloud; this
    is accepted as a deliberate cost/egress-fee tradeoff, not an
    oversight (Architecture A15).
22. NestJS is recommended as the Node.js framework (the team specified
    Node.js as the runtime, not a specific framework) — **needs team
    confirmation**, a plainer Express/Fastify setup is an equally valid
    choice within "Node.js backend."
23. Kafka is run via a managed service (e.g. Confluent Cloud / Google
    Cloud Managed Service for Apache Kafka) rather than self-hosted on
    GKE for v1, to avoid taking on Kafka operational burden before the
    team has production experience with it — **team should confirm**
    managed vs. self-hosted (e.g. Strimzi on GKE) preference.

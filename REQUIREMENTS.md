# StudeSafe — Software Requirements Specification & Technology Stack

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

## 3. Recommended Technology Stack

Choices below favor a **fast-to-market, well-supported, India-deployable**
stack. All are **[ASSUMPTION]** in the sense that the source brief specifies
no stack — these are recommendations, not mandates, and should be validated
against team expertise.

### 3.1 Mobile Apps (Parent, Driver/Carpool, Staff)
- **Framework:** React Native (with Expo or bare workflow) or Flutter —
  single codebase across iOS/Android, role-based navigation for the four
  client surfaces described in Architecture §2.
  - *Recommendation:* **React Native** if the team's web engineers will
    also touch mobile (shared TS/JS knowledge with the admin dashboard);
    **Flutter** if camera/QR/background-GPS performance is prioritized
    over code-sharing with web devs. Either is viable; pick one and don't
    split the team across both.
- **QR scanning:** `react-native-vision-camera` + `vision-camera-code-scanner`
  (or Google **ML Kit Barcode Scanning** natively) for fast, reliable QR
  decode including low light/motion (bus environment).
- **QR generation (server-side):** `qrcode` (Node) or `python-qrcode`
  to render the printable ID-card artifact.
- **Maps:** Google Maps SDK (best India coverage/geocoding) via
  `react-native-maps`; Mapbox as an alternative if usage-based Google Maps
  pricing becomes a concern at scale.
- **Background location:** platform-appropriate foreground-service /
  background-location APIs (Android foreground service with persistent
  notification while a trip is active, to comply with Android background
  location restrictions and to be transparent to the driver that tracking
  is on).
- **Offline storage/queue:** SQLite (via `WatermelonDB`,
  `react-native-sqlite-storage`, or Flutter's `sqflite`/`drift`) for
  queued scans/pings; background sync worker.
- **Push notifications:** Firebase Cloud Messaging (Android + fallback
  transport) / APNs (iOS), unified via **Firebase Cloud Messaging** SDK or
  a wrapper like `notifee`/`react-native-push-notification`.
- **State/data layer:** React Query / Apollo (if GraphQL) or RTK Query for
  REST, WebSocket client for live map/alerts.

### 3.2 School Admin / Coordinator Web Dashboard
- **Framework:** React (Next.js) or Vue — a data-dense, real-time
  dashboard (roster tables, fleet map, escalation queue).
- **Map:** Google Maps JS SDK / Mapbox GL JS.
- **Real-time updates:** WebSocket client (native or `socket.io-client`)
  subscribed to fleet/escalation channels.
- **Charts/reporting:** a standard charting lib (e.g. Recharts/ECharts)
  for on-time-performance / escalation-frequency reports.

### 3.3 Backend Services
- **Language/runtime:** Node.js (NestJS) or Python (FastAPI/Django), or
  Go for the highest-throughput services (Location ingestion).
  - *Recommendation:* **NestJS (TypeScript)** for most services — shares
    types/tooling with a React/Next.js frontend, strong support for
    modular service boundaries (matches the service breakdown in
    Architecture §4), good WebSocket/Gateway support out of the box.
    Alternatively **FastAPI (Python)** if the team is Python-leaning
    (also convenient if/when adaptive expected-time-window learning
    (§4.6, Assumption A8) becomes a small ML/statistics task).
- **API style:** REST (OpenAPI-documented) for CRUD; WebSocket (Socket.IO
  or native `ws`) for live location + live alert push; consider gRPC for
  internal service-to-service calls if the team wants strict contracts
  (optional, not required for v1).
- **API Gateway / BFF:** Kong, AWS API Gateway, or a lightweight
  NestJS/Express gateway module — handles authN/Z, rate limiting, routing
  to internal services.
- **Event bus:** **Apache Kafka** (durable, replayable, good fit for the
  audit/event-sourced design in Architecture §4.4/§4.10) or **RabbitMQ**
  (simpler ops, sufficient if event volume is moderate at launch).
  *Recommendation:* start with **RabbitMQ** for lower operational
  overhead at pilot scale; migrate/add Kafka when location-ping volume and
  audit/replay needs grow.
- **Scheduler / delayed jobs (for expected-window timers,
  escalation-step delays):** BullMQ (Redis-backed, Node ecosystem) or
  Temporal.io (if the team wants durable-workflow guarantees for the
  multi-step escalation chain — arguably a very good fit given escalation
  is exactly a long-running, resumable workflow).

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
- **Object storage:** AWS S3 (or GCS) for QR/ID-card images, any
  document uploads.
- **Search (optional, later phase):** OpenSearch/Elasticsearch for
  admin-side free-text search across large rosters/logs, if needed beyond
  what Postgres full-text search handles.

### 3.5 Third-Party / External Services
- **Push notifications:** Firebase Cloud Messaging (cross-platform).
- **SMS & voice (India-first):** **MSG91**, **Exotel**, or **Kaleyra**
  (India-focused providers with good deliverability and DLT-registration
  support, which is a **regulatory requirement for commercial SMS in
  India**); **Twilio** as a global-fallback/alternative.
  **[ASSUMPTION/NOTE: Indian SMS regulations require DLT (Distributed
  Ledger Technology) template registration for any transactional/
  promotional SMS — this is an operational/compliance task, not just a
  vendor choice.]**
- **Maps/geocoding:** Google Maps Platform (Maps SDK, Geocoding,
  Directions APIs) — best road/address coverage for Indian cities;
  Mapbox as a cost alternative.
- **Emergency/police escalation:** no verified public dispatch API assumed
  to exist for this market; v1 implements this as a human-triggered
  phone call / local emergency-contact workflow (Architecture A9), not an
  automated API integration. If a city/state emergency-dispatch API
  becomes available it can be added as an alternate `NotificationService`
  channel.

### 3.6 Infrastructure & DevOps
- **Cloud provider:** AWS or GCP, deployed in an **India region**
  (`ap-south-1` / `asia-south1`) for latency and data-residency reasons
  (Architecture A14).
- **Compute:** Containerized services on **Kubernetes** (EKS/GKE) or a
  simpler managed container platform (AWS ECS Fargate / Google Cloud Run)
  if the team wants to defer Kubernetes operational overhead until scale
  demands it.
  *Recommendation for v1/pilot:* managed container platform (ECS
  Fargate / Cloud Run) — lower ops burden; migrate to Kubernetes if/when
  the service count and scaling needs justify it.
- **CI/CD:** GitHub Actions (build, test, lint, deploy pipelines per
  service + per mobile app).
- **IaC:** Terraform for cloud resources.
- **Monitoring/observability:** Prometheus + Grafana (metrics), OpenTelemetry
  (tracing), **Sentry** (mobile + backend error tracking) — important
  given this is a safety-critical alerting product where silent failures
  are unacceptable.
- **Logging:** centralized structured logging (e.g. CloudWatch Logs /
  Loki + Grafana).
- **Secrets management:** AWS Secrets Manager / GCP Secret Manager /
  HashiCorp Vault.

### 3.7 Testing
- **Backend:** unit tests (Jest for Node/NestJS, or Pytest for
  Python), integration tests against a containerized Postgres/Redis/MQ
  (Testcontainers), contract tests for the API (OpenAPI-driven).
- **Mobile:** component/unit tests (Jest + React Native Testing Library,
  or Flutter's built-in test framework), E2E tests (Detox for RN,
  or Flutter Driver/Patrol) especially for the scan-flow and offline-sync
  paths, since those are safety-critical.
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
| FCM / APNs | Push notifications | Standard mobile push |
| SMS/Voice gateway (MSG91/Exotel/Twilio) | SMS + voice notifications, escalation | DLT template registration required in India |
| Google Maps / Mapbox | Live map, geocoding, ETA | Usage-based pricing — monitor at scale |
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

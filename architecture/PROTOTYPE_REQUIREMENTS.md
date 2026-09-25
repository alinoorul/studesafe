# Studesafe Prototype — Requirements & Technology Stack

> Companion to [`PROTOTYPE_ARCHITECTURE.md`](./PROTOTYPE_ARCHITECTURE.md).
> Target: one school, 500–1,000 students, ≤ 15,000 requests on the busiest
> day, cheap to host and quick to deploy. The full-scale requirements are
> in [`REQUIREMENTS.md`](./REQUIREMENTS.md); IDs here are prefixed `P-` to
> keep the two apart.

## 1. Scope

**In the prototype**

- Phone-OTP login for every role; one mobile app with role-based tabs.
- QR code per student, printed on the ID card; reissue on loss.
- Checkpoint scans by parents (home), drivers (boarding) and gate staff
  (arrival and departure), working offline.
- Live bus and carpool location with ETA; "bus approaching" alert.
- Push notification on every checkpoint and every escalation; SMS only
  for login codes.
- Missed-checkpoint detection and the four-level escalation chain, with a
  human-confirmed police step.
- Driver "running late" and admin "route delayed" broadcasts.
- A small web admin for setup (CSV import, routes on a map, QR card
  printing), a live today board, and CSV reports.

**Out of the prototype** (in the full architecture, added when needed)

- Classroom checkpoint and school attendance/biometric integrations.
- Voice calls and any automated police contact.
- Multiple schools and a super-admin console (the schema supports it; no
  UI).
- Learned/adaptive time windows, analytics dashboards, free-text search.
- Traffic-aware ETA (Routes API).
- High availability (more than one server).

## 2. Functional requirements

### 2.1 Accounts and roles

- **P-FR-1** Roles: parent, driver, gate staff (includes teachers),
  transport coordinator, school admin. One person may hold several roles.
- **P-FR-2** Login is by phone number and a 6-digit SMS code for every
  role, including admin web. No passwords.
- **P-FR-3** Admins add staff, drivers and coordinators by phone number.
  Guardians are created by the student CSV import; a guardian's first
  login links them automatically to every student listing their number.
- **P-FR-4** On first login a guardian must accept a consent screen before
  seeing any student data; the time and consent-text version are stored.
- **P-FR-5** A session lasts 90 days on a device unless revoked by an
  admin (for example, a lost staff phone).

### 2.2 Students and QR codes

- **P-FR-6** CSV import columns: student name, grade label (optional),
  guardian 1 name and phone, guardian 2 name and phone (optional), AM
  route and stop (optional), PM route and stop (optional). The import
  reports every rejected row with a reason; valid rows still import.
- **P-FR-7** Each student gets a QR token of 128 random bits. The QR
  encodes `SS1:<token>` only: no name, no ID number.
- **P-FR-8** The admin web prints QR cards as a print-ready page (name +
  QR, cut marks) for one student, a class, or everyone.
- **P-FR-9** Reissuing a QR invalidates the old code immediately; history
  stays attached to the student.

### 2.3 Routes and vehicles

- **P-FR-10** A vehicle is a bus or a carpool, with a label ("Bus 12")
  and an assigned driver.
- **P-FR-11** A route belongs to one vehicle and one direction (AM or PM),
  with a departure time, a trip length in minutes, and ordered stops.
  Each stop has a label, a map pin, and a minute offset from departure.
- **P-FR-12** A student rides at most one AM route and one PM route.

### 2.4 Checkpoint scanning

- **P-FR-13** Checkpoint types: `home_depart`, `board_am`, `gate_in`,
  `gate_out`, `board_pm`, `home_arrive`.
- **P-FR-14** The type is set by the scanner's context: driver by the
  active trip's direction; gate staff by an Arrival/Departure toggle;
  parent by "Leaving home" / "Arrived home" (preselected by time of day).
- **P-FR-15** **Continuous scanning:** the camera stays open; each decoded
  code is recorded without a tap and confirmed by the student's name,
  a green flash and a beep. The same code within 10 seconds is ignored.
- **P-FR-16** Validation, done on the phone first (against the cached
  roster) and again on the server:
  - Unknown or reissued code: red screen "Not a valid Studesafe card".
  - Driver scans a student not on this vehicle today: red screen "Not on
    this bus", the scan is still recorded with `flag = not_on_roster`, and
    the coordinator gets a push.
  - A parent can only scan their own children.
- **P-FR-17** Scans work offline: queued on the phone with a client UUID
  and timestamp, uploaded in batches when online, deduplicated by UUID on
  the server. The app shows "N scans waiting to upload".
- **P-FR-18** A guardian or admin can mark a student absent for AM, PM or
  the whole day; that part of the day's plan is skipped.

### 2.5 Live tracking

- **P-FR-19** The driver starts and ends each trip explicitly. GPS is
  sampled only during a trip (every 10 s, uploaded every 30 s), with an
  Android foreground-service notification showing that tracking is on. A
  trip left running ends automatically after 3 hours.
- **P-FR-20** A parent sees the vehicle carrying their child on a map with
  an approximate ETA to the child's stop (or to school), only while that
  trip is active.
- **P-FR-21** When the vehicle comes within 1 km of a rider's stop, that
  rider's guardians get one "Bus approaching" push per trip.
- **P-FR-22** Coordinators and admins see all active vehicles on a map
  (mobile and web), each with "last seen N s ago".

### 2.6 Notifications

- **P-FR-23** Every recorded checkpoint sends a push to the student's
  guardians ("Aryan boarded Bus 12 at 7:42 AM").
- **P-FR-24** All notifications, including escalations, are push only.
  SMS is used for nothing but login codes (P-FR-2). Because push is the
  only alert channel:
  - Escalation pushes are high priority: a separate "Safety alerts"
    Android notification channel with sound, and iOS time-sensitive
    notifications.
  - The app reports on every open whether notifications are allowed, and
    shows a red banner until they are turned on.
  - The admin web lists guardians and staff who can't be reached by push
    (notifications off, invalid push token, or no app open in 7 days).
- **P-FR-25** Driver "running late" (10/20/30 min) and admin "route
  delayed" send a push to the route's guardians and move that route's
  pending deadlines back by the same amount.
- **P-FR-26** Every notification is stored with template, priority,
  status (`queued`, `sent`, `failed`) and attempt count; failures are
  retried up to 3 times.

### 2.7 Missed checkpoints and escalation

- **P-FR-27** Each school day, the system builds every active student's
  expected checkpoints with deadlines, per the table in architecture
  §6.1, and re-anchors each deadline to the actual time of the previous
  scan.
- **P-FR-28** A deadline passing with no scan opens an escalation and
  alerts the guardians within 60 seconds.
- **P-FR-29** Unresolved escalations advance: coordinator at +5 min,
  admin at +10 min, "Call police" prompt to admin and coordinator at +15
  min, repeated every 5 min until resolved. All delays are school
  settings. Levels with nobody assigned are skipped.
- **P-FR-30** Coordinator and admin alerts are grouped when more than 3
  students on the same trip miss the same checkpoint. Guardians always
  receive individual alerts.
- **P-FR-31** Coordinator and admin alerts include the vehicle's last
  position and how long ago it was reported.
- **P-FR-32** A matching scan (including one synced late) resolves the
  escalation automatically and notifies everyone already alerted.
- **P-FR-33** Any alerted person, including the guardian, can resolve with
  a reason (found safe / absent / alternate transport / other) and an
  optional note.
- **P-FR-34** The police step is never automatic. "Call police" opens the
  dialer with the school's configured number (default 112); the user then
  records "Police contacted" with a note.
- **P-FR-35** Every escalation level change, notification and resolution
  is stored as an append-only record with actor and time.

### 2.8 Admin web

- **P-FR-36** Pages: Students (list, CSV import, QR reissue, print),
  Routes & Vehicles (map-based stop editor), People (invite, roles,
  revoke sessions), Today (live roster per vehicle, open escalations,
  fleet map), Settings (school times, tolerance, escalation delays,
  emergency number, closure dates), Reachability (P-FR-24), Reports.
- **P-FR-37** Reports: CSV export of a day's checkpoints (who, what, when,
  who scanned, flags) and escalations (levels reached, who was notified,
  resolution, time to resolve).

## 3. Non-functional requirements

Targets are sized for a pilot, not for the full-scale rollout.

| ID | Area | Requirement |
|---|---|---|
| P-NFR-1 | Load | Sustain 15,000 requests/day with peaks of 20 req/s and 500 open WebSocket connections on one e2-small VM. |
| P-NFR-2 | Availability | 99.5% of school-operating time (06:00–17:00 IST on school days). Deploys and maintenance happen outside that window. |
| P-NFR-3 | Recovery | Recovery time ≤ 30 min (restore VM from snapshot or redeploy); recovery point ≤ 6 h (backup interval). |
| P-NFR-4 | Scan speed | On-device confirmation (name + green flash) < 1 s after decode, online or offline. ≤ 5 s per student end to end, including presenting the card. |
| P-NFR-5 | Notification latency | Scan to push dispatched: p95 < 10 s when the scanning phone is online. Deadline passed to level-1 alert dispatched: < 60 s. |
| P-NFR-6 | Live location | Position shown to parents is ≤ 45 s old during an active trip with network coverage. |
| P-NFR-7 | No lost events | No scan, escalation or notification is lost to an app restart, server restart or network drop (client queue + UUID dedup + database outbox). |
| P-NFR-8 | Monitoring | An alert reaches the on-call person within 5 min if the API is down, the database is unreachable, or the sweeper hasn't run for 2 min. |
| P-NFR-9 | Security | TLS everywhere; database not internet-reachable; server-side authorization on every request and WebSocket subscription; OTP rate limits (3 per 10 min per phone, 20 per hour per IP). |
| P-NFR-10 | Privacy | QR holds no personal data; student data limited to name, grade label and checkpoint history; GPS kept 30 days; guardian consent recorded (DPDP Act 2023). |
| P-NFR-11 | Devices | Driver and gate apps run on Android 10+ phones with 3 GB RAM. Parent app on Android 10+ and iOS 16+. |
| P-NFR-12 | Battery | A 45-minute trip uses ≤ 5% battery on a mid-range Android phone (10 s sampling, balanced accuracy). |
| P-NFR-13 | Cost | Infrastructure ≤ $35/month; SMS (login codes only) ≤ ₹300/month after initial sign-up. |
| P-NFR-14 | Deployability | A fresh VM goes from empty to serving in under an hour using the runbook in `deploy/`. |

## 4. Technology stack

Each item is here because something in §2 or §3 needs it. "Kept" means
the full architecture already chose it.

### 4.1 Mobile app

| Need | Choice | Status |
|---|---|---|
| iOS + Android from one codebase | React Native, **Expo** (SDK current at start), EAS dev build | Kept |
| QR scanning | **`expo-camera`** (`CameraView` barcode scanning) | Changed from `react-native-vision-camera`: first-party, one fewer native module |
| Maps | **`react-native-maps`** with `PROVIDER_GOOGLE` (Maps SDK for Android/iOS) | Kept |
| Background GPS | **`expo-location`** background task + `expo-task-manager`, Android foreground service | Kept |
| Push | **`@react-native-firebase/messaging`** (FCM on Android and iOS) | Kept |
| Offline queue and roster cache | **`expo-sqlite`** | Kept |
| API data | **RTK Query** | Kept |
| Live map updates | React Native's built-in `WebSocket` | Kept (no Socket.IO) |
| Crash reports | `@sentry/react-native` (free tier) | Kept |

### 4.2 Admin web

| Need | Choice | Status |
|---|---|---|
| UI | **React + Vite**, built to static files, served by the API at `/admin` | Changed from Next.js: no second server process |
| Maps | Google Maps JavaScript API via **`@vis.gl/react-google-maps`** | Kept (Google Maps) |
| API data | **RTK Query** | Kept |

### 4.3 Server

| Need | Choice | Status |
|---|---|---|
| Runtime | **Node.js 22 LTS**, TypeScript | Kept |
| Web framework | **Fastify** with `@fastify/websocket`, `@fastify/rate-limit`, `@fastify/jwt`, `@fastify/multipart`, `@fastify/static` | Changed from NestJS: lighter |
| Database | **PostgreSQL 16** (Docker, same VM) | Kept (without PostGIS/TimescaleDB) |
| Database access | **Drizzle ORM** + `drizzle-kit` migrations, `postgres` (postgres.js) driver | New (unspecified before) |
| Timers and jobs | In-process **sweeper loop** over SQL tables | Replaces Kafka, BullMQ, Redis |
| Push | **`firebase-admin`** (FCM HTTP v1) | Kept |
| SMS (login codes only) | **MSG91** HTTP API, one DLT-registered OTP template | Kept, reduced to OTP |
| QR images | **`qrcode`** (SVG, on demand) | Kept |
| CSV | `csv-parse` | New |
| Errors | `@sentry/node` | Kept |

### 4.4 Infrastructure

| Need | Choice | Status |
|---|---|---|
| Hosting | **GCP Compute Engine e2-small**, `asia-south1` (Mumbai), Ubuntu LTS, Docker Compose | Kept GCP and region; replaces GKE |
| TLS and reverse proxy | **Caddy** (automatic Let's Encrypt certificates) | Replaces API gateway |
| Container registry | **Artifact Registry** (`asia-south1`), keep last 5 images | New (cents per month) |
| CI/CD | **GitHub Actions** (test, build, deploy over SSH); **EAS Build / EAS Update** for the app | Kept |
| Backups | `pg_dump` every 6 h to a GCS bucket (30-day lifecycle) + daily disk snapshots | New |
| Monitoring | Cloud Monitoring **uptime check** on `/health` + Sentry | Replaces OpenTelemetry/Prometheus stack |
| Secrets | `.env` on the VM, root-only (mode 600) | Replaces Secret Manager for now |

**Explicitly not used** (and why): Kafka, Redis, BullMQ/Temporal (the
database is the queue at this load); Kubernetes (one VM); PostGIS and
TimescaleDB (20 vehicles need no spatial index); Cloudflare R2 (nothing
to store); NestJS and Next.js (heavier than needed); Socket.IO (the
native WebSocket is enough); Terraform and Secret Manager (one machine);
Google Directions/Routes and Geocoding APIs (cost per call, not needed).

## 5. API

REST + JSON over HTTPS; JWT in the `Authorization` header. All times in
ISO 8601 UTC; the school's timezone (`Asia/Kolkata`) is used only for
schedule math.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/otp` · `POST /auth/verify` · `POST /auth/refresh` · `POST /auth/logout` · `POST /devices` (FCM token + whether notifications are allowed, sent on every app open) · `POST /consent` |
| Parent | `GET /me/today` (children, day plans, vehicles, open alerts) · `POST /students/:id/absences` |
| Scans | `POST /scans` (one scan or a batch of up to 200) |
| Driver | `GET /trips/today` (routes, roster with QR tokens for offline checks) · `POST /trips/:id/start` · `POST /trips/:id/end` · `POST /trips/:id/locations` · `POST /trips/:id/late` |
| Escalations | `GET /escalations?status=open` · `POST /escalations/:id/resolve` · `POST /escalations/:id/police-contacted` |
| Live | `WS /live` then subscribe to `vehicle:<id>` (server checks access) or `school` (coordinator/admin) |
| Admin | CRUD on `/students`, `/vehicles`, `/routes` (with stops), `/people` · `POST /import/students` · `POST /students/:id/reissue-qr` · `GET /qr-cards?class=&route=` · `POST /broadcasts` · `GET/PUT /settings` · `GET/POST /closures` · `GET /reachability` · `GET /reports/checkpoints.csv?date=` · `GET /reports/escalations.csv?from=&to=` |
| Ops | `GET /health` (checks database and sweeper heartbeat) |

## 6. Default settings

All defaults are editable per school in Settings.

| Setting | Default |
|---|---|
| Deadline tolerance | 15 min |
| Escalation: guardian → coordinator → admin → police prompt | 0 / +5 / +10 / +15 min |
| Police prompt reminder | every 5 min until resolved |
| Emergency number | 112 |
| Grouped staff alert threshold | more than 3 students on one trip |
| Approach alert radius | 1 km |
| GPS sample / upload interval | 10 s / 30 s |
| Trip auto-end | 3 h after start |
| Duplicate-scan window | 10 s |
| Push unreachable after | notifications off, invalid token, or no app open in 7 days |
| GPS retention | 30 days |
| Sweeper interval / heartbeat alarm | 30 s / 2 min |
| Access / refresh token lifetime | 15 min / 90 days |

## 7. Pilot readiness checklist

The prototype is ready for a pilot school when all of these pass:

1. **Replay-a-day test** (automated, in CI): a script drives a full school
   day against a test database with a controllable clock, including
   missed scans, a late bus, an absent student, a late offline sync and a
   parent resolving an alert. It asserts every escalation opens, advances
   and resolves at the right minute with the right recipients.
2. **Restart safety:** kill the API mid-escalation; after restart, no alert
   is lost or sent twice.
3. **Offline field test:** a driver phone in airplane mode scans 40 cards,
   reconnects, and all 40 arrive once, in order, with parents notified.
4. **Background GPS field test:** a full 45-minute route with the phone
   locked; the parent map never goes more than 60 s without an update.
5. **Gate throughput test:** 5 staff phones scan 1,000 cards in ≤ 15
   minutes of continuous scanning.
6. **Push on both platforms:** an escalation push reaches a locked Android
   phone in battery-saver mode and a locked iPhone in Focus mode (if iOS
   is in the pilot), with sound, within 30 seconds. Turning notifications
   off shows the red banner in the app and the user on the admin
   Reachability page.
7. **Restore drill:** restore last night's backup onto a fresh VM and
   serve from it in ≤ 30 minutes.
8. **Alerting drill:** stop the sweeper; the on-call phone gets an alert
   within 5 minutes.

## 8. Setup order (critical path first)

1. **Start DLT registration** for the SMS sender ID and the one OTP
   template. Approval can take days and blocks login, so it goes first.
2. Firebase project for FCM; Android and iOS app registrations.
3. Google Maps API keys, one per platform, each restricted (Android
   package + SHA-1, iOS bundle ID, admin web domain).
4. GCP project: e2-small VM in `asia-south1`, static IP, firewall 80/443,
   GCS backup bucket with lifecycle rule, snapshot schedule, uptime check.
5. DNS `A` record for the API domain; `docker compose up -d`; Caddy
   fetches the certificate.
6. Create the first admin from the server CLI; import students; place
   routes and stops; print QR cards.
7. EAS builds; distribute to pilot drivers and staff (Play internal
   testing), then parents.

## 9. Assumptions

1. Sizing uses the top of the range: 1,000 students, 600 riders, 20
   vehicles, 45-minute trips, 2 trips per vehicle per day (§2 of the
   architecture). Fewer riders only lowers the load.
2. One school per deployment for the pilot; the schema keeps `school_id`
   so a second school needs no migration.
3. The landing page's journey (parent scans at home, boarding scans only,
   gate in and out) is the current product definition; the full-scale
   docs should be updated to match once confirmed.
4. Every notification, including escalations, is a push; SMS carries only
   login codes (team decision, to keep the build cheap). The accepted risk
   is that a guardian whose phone is off or has notifications disabled
   misses their alert; the chain still reaches staff 5 minutes later.
   The landing page's SMS promises need rewording (architecture open
   question 1).
5. Android is the main platform for drivers and gate staff; iOS matters
   for parents only.
6. English only at launch, with strings kept in per-language files; Hindi
   for driver and gate screens if the pilot needs it.
7. A single VM's availability (target 99.5% in school hours) is
   acceptable for a pilot, provided parents are told it is a pilot and
   that a missing confirmation is visible in their app's timeline even
   when an alert is not.
8. All prices are approximate September 2026 list prices and must be
   checked at signup; Google Maps mobile SDK map loads are assumed to stay
   unbilled.

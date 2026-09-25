# Studesafe Prototype — Software Architecture

> **Scope:** one school, 500–1,000 students, ≤ 15,000 API requests on the
> busiest day. For the full multi-school target design (GKE, Kafka, Redis,
> microservices), see [`ARCHITECTURE.md`](./ARCHITECTURE.md). Requirements
> for this prototype are in [`PROTOTYPE_REQUIREMENTS.md`](./PROTOTYPE_REQUIREMENTS.md).

## 1. Prototype thesis

**Cheap, fast, quick to deploy, essential functions only.**

Every component below had to pass three tests:

1. **Required:** removing it breaks a promise the product makes to parents
   or schools (see the landing page: checkpoint scans, live bus map,
   instant alerts, escalation to a human).
2. **Essential at this scale:** it solves a problem that actually exists
   at 1,000 students, not at 100,000.
3. **Carries forward:** where the full architecture already chose a
   technology (Node.js, PostgreSQL, Expo, Google Maps, FCM), the prototype
   uses the same one, so prototype code is not thrown away when the
   school count grows.

**Hosting is the one deliberate exception.** The full architecture runs
on GCP; the prototype runs on a **DigitalOcean droplet in Bangalore**
because, at this size, it costs about a quarter as much (the droplet
price already includes the public IP address, disk and bandwidth that
GCP bills separately). Everything runs in Docker Compose on plain
PostgreSQL, so moving to GCP later is a database dump and restore, not a
rewrite.

The result is **one small server running one Node.js process and one
PostgreSQL database**, one mobile app for every role, and a small web
admin served by that same server, for **about $7–8 a month**.

## 2. Sizing: why one server is enough

Worst-case school day at the top of the range (all figures are
assumptions, stated so they can be corrected):

- 1,000 students, about 1,000 parent app users.
- 600 students ride school transport on 20 vehicles (12 buses, 8
  carpools); each vehicle runs 2 trips of about 45 minutes.
- 5 gate/staff phones, 3–5 admin and coordinator users.

| Source | Calculation | Requests/day |
|---|---|---|
| Checkpoint scans | home depart 1,000 + gate in 1,000 + gate out 1,000 + home arrive 1,000 + board AM 600 + board PM 600 | 5,200 |
| GPS uploads from drivers | 20 vehicles × 2 trips × 90 (one batch every 30 s for 45 min) | 3,600 |
| Parent app opens | 1,000 parents × 3 opens × 1 request (`GET /me/today`) | 3,000 |
| Live-map sessions | ~30% of parents × 2 trips, 1 WebSocket connect each | 600 |
| Driver and staff app | trip start/end, roster fetch | ~200 |
| Escalation actions | resolve, police-called, running late | ~100 |
| Admin web | page loads, WebSocket connects | ~200 |
| Auth and device registration | OTP, token refresh, push token | ~300 |
| **Total** | | **≈ 13,200** |

About 80% of this lands in two 90-minute windows (morning pickup and
afternoon drop), which averages **~1 request per second**, with short
bursts of 5–10 req/s at the school gate. A single Node.js process sharing
a 1-vCPU droplet with PostgreSQL serves a few hundred simple
database-backed requests per second, so the prototype has **roughly
20–50× headroom** over its own peak.

Two design choices keep the budget this small:

- **Live location is pushed over WebSocket, not polled.** If 300 parents
  polled every 15 s during a 45-minute trip, that alone would be
  ~108,000 requests a day, seven times the whole budget. One WebSocket
  per viewing session costs one request.
- **GPS is batched.** The driver app samples every 10 s but uploads every
  30 s (3 points per request).

Storage is equally small: ~5,000 checkpoint rows and ~11,000 GPS rows a
day. PostgreSQL handles years of this without tuning.

## 3. What changed from the full architecture

| Full architecture | Prototype | Why |
|---|---|---|
| 10 microservices on GKE | **One Node.js process** (modular monolith: same module boundaries, one deployable) | ~1 req/s does not need independent scaling. Modules map 1:1 to the full design's services, so they can be split later along the same seams. |
| Kubernetes (GKE Autopilot) on GCP | **One DigitalOcean droplet** (1 GB, Bangalore) running Docker Compose | No cluster to operate; one `docker compose up`. About a quarter of GCP's price at this size, with public IP, disk and bandwidth included. |
| Kafka event bus | **PostgreSQL tables** (outbox pattern) | Events are rows; the audit trail is the same rows. No broker to run. |
| Redis (positions, pub/sub) | **Process memory** | One process, so an in-memory map of latest positions and WebSocket subscribers is enough. Rebuilt from the database on restart. |
| BullMQ / Temporal for timers | **A 30-second SQL "sweeper" loop** | Deadlines live in the database, so a restart loses nothing. See §5.4. |
| PostGIS + TimescaleDB | **Plain PostgreSQL** | "Is the bus within 1 km of the stop" is a haversine calculation in JavaScript for 20 vehicles. |
| Cloudflare R2 object storage for app files | **Backups only** | Studesafe stores no ID-card images and QR codes are rendered on demand, so R2 only holds encrypted database backups, inside its free tier. |
| Next.js admin dashboard | **Small React (Vite) SPA served by the API server** | No second server process. The React components move to Next.js unchanged if server rendering is ever needed. |
| NestJS | **Fastify** | Lighter, fast, built-in request validation, first-party WebSocket and rate-limit plugins. |
| 3 mobile apps | **One Expo app, role-based tabs** | One build, one store listing, one codebase (already Assumption A1). |
| `react-native-vision-camera` | **`expo-camera`** (built-in barcode scanning) | First-party Expo module, one fewer native dependency. Switch only if field tests show low-light scanning problems. |
| Integration adapter (biometric gates) | **Out of scope** | Phone-camera scanning covers every checkpoint. |
| Voice calls | **Out of scope** | The police step is a human tapping a phone number (already Assumption A9). |
| GCP Secret Manager, Terraform, Cloud Monitoring, OpenTelemetry | **`.env` file on the droplet (mode 600), a setup runbook, a heartbeat monitor, logs + Sentry** | One server and one process do not need these yet. |
| Directions / Geocoding APIs | **Not called** | ETA is computed on the server; stops are placed by dropping a pin on a map. Keeps Google Maps at $0. |

**Kept unchanged:** Node.js, PostgreSQL, React Native with Expo, RTK Query,
Google Maps SDK, Firebase Cloud Messaging (direct, via the Admin SDK),
MSG91 for SMS (now login codes only), the `qrcode` package, `expo-sqlite` for the offline queue,
hosting in India (Bangalore rather than Mumbai), the human-confirmed
police step, and `school_id` on every table (the schema stays
multi-school-ready even though the prototype serves one school).

## 4. Architecture overview

```mermaid
flowchart LR
    APP["Studesafe app (Expo)<br/>parent · driver · gate staff<br/>coordinator · admin"]
    WEB["Admin web<br/>React SPA"]
    MAPS["Google Maps<br/>SDK in app, JS API in admin<br/>client-side only"]
    UP["UptimeRobot<br/>HTTPS check on /health"]
    subgraph VM["1 × DigitalOcean droplet · 1 GB · Bangalore · Docker Compose"]
        CADDY["Caddy<br/>automatic HTTPS"] --> API["Node.js API (Fastify)<br/>REST + WebSocket<br/>sweeper every 30 s<br/>serves admin SPA"]
        API --> PG[("PostgreSQL 16")]
    end
    FCM["Firebase Cloud Messaging<br/>push to Android,<br/>and to iOS via APNs"]
    SMS["MSG91 SMS<br/>login codes only"]
    SENTRY["Sentry<br/>errors, free tier"]
    R2[("Cloudflare R2<br/>encrypted backups<br/>every 6 h")]
    HC["Healthchecks.io<br/>sweeper heartbeat"]
    APP -->|HTTPS, WSS| CADDY
    WEB -->|HTTPS, WSS| CADDY
    APP -.-> MAPS
    WEB -.-> MAPS
    UP -.-> CADDY
    API --> FCM
    API --> SMS
    API -.-> SENTRY
    API -.-> HC
    PG -.-> R2
```

There is exactly **one server to deploy, one database to back up, one
mobile app to build**, and three external services that matter at
runtime (FCM, MSG91, Google Maps). Every notification goes out as a push
through FCM; SMS is used only to send login codes. All map rendering
happens on the client, so the server never calls Google Maps.

## 5. Components

### 5.1 Mobile app (one Expo app, every role)

After OTP login the app shows tabs for the user's role(s). A user can
hold more than one role (a parent who also drives a carpool gets both
sets of tabs and a role switcher).

| Role | Screens |
|---|---|
| **Parent** | **Today**: each child's checkpoints for the day, confirmed in green, overdue in red (computed on the phone from the cached plan, so an overdue check shows even if the server is unreachable). **Live map**: the child's vehicle and an ETA, only while that trip is active. **Scan**: "Leaving home" / "Arrived home". **Alerts**: open escalations for their child, with one-tap "Resolve" (website FAQ: parents can stop an escalation). **Absent today** (AM, PM or full day). |
| **Driver** (bus or carpool) | **Trip**: start/end (GPS runs only between the two). **Scan**: continuous camera scanning. **Roster**: who has boarded and who hasn't. **Running late**: one tap, picks 10/20/30 min. Offline banner showing queued scans. |
| **Gate staff / teacher** | **Scan** with an Arrival / Departure toggle, continuous camera scanning. **Today** counts (arrived, departed, not yet seen). |
| **Coordinator / admin** | **Alerts** queue (open escalations, resolve, one-tap "Call police"). **Fleet map** (all active vehicles). **Broadcast delay** to a route's parents. |

**Push is the only alert channel**, so the app works to keep it reachable:

- Escalation pushes are sent as **high-priority** FCM messages on a
  dedicated "Safety alerts" Android notification channel (sound on,
  shown even under battery saver) and as **time-sensitive** notifications
  on iOS, so they get through Do Not Disturb/Focus if the user allows it.
- On every app open, the app checks whether notifications are allowed and
  reports that to the server with its push token. If they are off, the
  app shows a red banner that stays until they are turned back on.
- The admin web lists guardians and staff who can't currently be reached
  by push (notifications off, or no app open in the last 7 days), so the
  school can follow up in person.
- If a guardian doesn't respond, the escalation chain still moves on to
  staff after 5 minutes (§6.2); a guardian's missed push delays nothing.

**Libraries:** Expo (EAS dev build: background location and FCM both
need native code, so Expo Go is not an option), `expo-camera` barcode
scanning, `react-native-maps` with `PROVIDER_GOOGLE`, `expo-location`
background task with an Android foreground-service notification while a
trip is active, `@react-native-firebase/messaging` for FCM on both
platforms, `expo-sqlite` for the offline scan and GPS queue, RTK Query
for REST, the built-in React Native `WebSocket` for the live map,
`@sentry/react-native` for crash reports.

### 5.2 Admin web (small React SPA)

Built with Vite, compiled to static files, served by the API server at
`/admin`. It covers only the jobs that need a keyboard and a big screen:

- **Students**: list, CSV import, reissue a QR (lost card), print QR
  cards (a print-ready HTML page, one card per student).
- **Routes and vehicles**: stops placed by dropping pins on a Google map,
  each with a minute offset from departure.
- **People**: invite staff, drivers, coordinators and admins by phone
  number.
- **Today board**: live roster per vehicle, open escalations, fleet map.
- **Settings**: school start/end times, tolerance, escalation delays,
  emergency phone number, school closure dates.
- **Reachability**: guardians and staff who can't currently receive push
  notifications.
- **Reports**: CSV export of the day's checkpoints and escalations.

Map: Google Maps JavaScript API via `@vis.gl/react-google-maps`. Data:
RTK Query (same as the mobile app).

### 5.3 API server (Fastify modular monolith)

One Node.js 22 LTS process in TypeScript. Modules mirror the full
architecture's services, so a later split follows existing seams:

| Module | Responsibility | Full-architecture equivalent |
|---|---|---|
| `auth` | Phone OTP via MSG91, JWT access + rotating refresh tokens, role checks | Identity & Access |
| `roster` | Students, guardians, QR tokens, vehicles, routes, stops, riders, absences, CSV import | Student & QR + Route & Roster |
| `checkpoints` | Scan ingestion (single or batch), dedup, roster validation, day-plan updates | Checkpoint + Expected-Window |
| `location` | Trip start/end, GPS batch ingestion, latest position in memory, approach alerts, ETA | Location |
| `escalation` | The sweeper (§5.4), resolve/ack actions, police-called logging | Escalation Engine |
| `notify` | Outbox drain: push via FCM (`firebase-admin`), retries, push-reachability tracking | Notification |
| `live` | WebSocket subscriptions and fan-out | API Gateway WebSocket path |
| `admin` | Settings, broadcasts, CSV reports, serves the SPA | Audit & Reporting (reporting part) |

**Libraries:** `fastify`, `@fastify/websocket`, `@fastify/rate-limit`,
`@fastify/jwt`, `@fastify/multipart` (CSV upload), `@fastify/static`
(admin SPA), `drizzle-orm` + `drizzle-kit` (typed SQL and migrations)
over `postgres` (postgres.js), `csv-parse`, `qrcode`, `firebase-admin`,
`@sentry/node`.

### 5.4 The sweeper: escalation engine without a job queue

This is the safety core, so it is deliberately boring. Every deadline is
a row in the database; a loop inside the API process runs every 30
seconds and does four things, each as an atomic SQL statement:

1. **Detect misses:** `UPDATE expected_checkpoints SET status = 'missed'
   WHERE status = 'pending' AND due_at < now() RETURNING …`. For each
   returned row, open an escalation at level 1 and queue notifications
   in the **same transaction**.
2. **Advance escalations:** `UPDATE escalations SET level = level + 1,
   next_step_at = … WHERE status = 'open' AND next_step_at < now()
   RETURNING …`, queuing the next level's notifications in the same
   transaction.
3. **Drain the outbox:** send every `notifications` row with status
   `queued` through FCM, mark `sent` or `failed`, retry failures up to 3
   times. A device token that FCM reports as invalid is deleted, which
   marks that user unreachable until they reopen the app. Scans also
   trigger an immediate drain, so a routine "boarded" push goes out
   within seconds rather than waiting for the next tick.
4. **Housekeeping:** at 04:30 school time, build the next school day's
   plan (§6.1); nightly, delete GPS pings older than 30 days and expired
   OTP codes and refresh tokens.

Each run writes a heartbeat timestamp to the database and, only once that
write succeeds, pings Healthchecks.io. If the pings stop for 2 minutes
(the process has died, the database is down, or the droplet is off),
Healthchecks.io alerts whoever is on call (§9.4). `/health` also returns
HTTP 503 if the last heartbeat is older than 2 minutes. **A silently
stopped sweeper is the worst failure this system can have, so it is the
thing monitoring watches.**

Why this is safe across restarts and crashes: the database, not memory,
holds every deadline and every unsent message. A crash between "decide"
and "send" leaves a `queued` row that the next run sends. The `UPDATE …
WHERE status = 'pending'` pattern means a row can only be claimed once.
If a second API instance is ever added, the sweeper takes a PostgreSQL
advisory lock so only one instance runs it.

### 5.5 PostgreSQL

PostgreSQL 16 in a Docker container on the same droplet, data on the
droplet's SSD in a Docker volume, reachable only on the Docker network
(never exposed to the internet). Memory settings are tuned for a 1 GB
server (`shared_buffers` 128 MB, `max_connections` 20). Schema in §8.

### 5.6 External services

| Service | Used for | Cost at this scale |
|---|---|---|
| **Firebase Cloud Messaging** | All push notifications, Android and iOS (FCM relays to APNs) | Free |
| **MSG91** (or Exotel/Kaleyra) | Login codes (OTP) only | Per SMS; roughly ₹100–250 a month, see §10 |
| **Google Maps Platform** | Maps SDK for Android/iOS in the app; Maps JavaScript API in admin web | $0 expected: mobile SDK map loads are not billed, and admin web stays inside the monthly free usage cap. No Directions or Geocoding calls. |
| **Cloudflare R2** | Encrypted database backups | Free tier (10 GB) |
| **Healthchecks.io** | Sweeper heartbeat alarm | Free tier |
| **UptimeRobot** | Public HTTPS check on `/health` | Free tier |
| **Sentry** | Crash and error reports, app and server | Free tier |

## 6. Checkpoints and escalation

### 6.1 The day plan

The QR code identifies the student; the **checkpoint type comes from who
is scanning and when** (a driver on an active AM trip records `board_am`;
gate staff record `gate_in` or `gate_out` from their Arrival/Departure
toggle; a parent records `home_depart` or `home_arrive`).

Each school day, each active student gets an ordered list of expected
checkpoints (`expected_checkpoints` rows) with a `due_at` deadline. When
a checkpoint is scanned, the next one's deadline is **re-anchored** to the
real scan time, so a bus that left late doesn't raise false alarms all
morning.

This follows the landing page's flow (parent scans at home, driver scans
on boarding, gate scans in and out). There are no bus-alight scans: the
gate scan confirms arrival at school, and the parent's home scan confirms
arrival home.

**Students who ride school transport** (`tolerance` defaults to 15 min):

| # | Checkpoint | Scanned by | Initial deadline | Re-anchored when previous is scanned |
|---|---|---|---|---|
| 1 | `home_depart` | Parent | Not escalated (informational) | — |
| 2 | `board_am` | Driver | AM departure + stop offset + tolerance | — |
| 3 | `gate_in` | Gate staff | AM departure + trip minutes + tolerance | board time + (trip minutes − stop offset) + tolerance |
| 4 | `gate_out` | Gate staff | School end + tolerance | — |
| 5 | `board_pm` | Driver | PM departure + tolerance | — |
| 6 | `home_arrive` | Parent | PM departure + stop offset + tolerance | board time + stop offset + tolerance |

**Students who don't ride** (parent drop-off, walkers): `gate_in` by
school start + tolerance, `gate_out` by school end + tolerance. Home
scans are optional and not escalated.

**Things that change the plan:**

- **Absent / not travelling** (parent or admin): the matching rows become
  `skipped`, so nothing escalates.
- **Running late** (driver) or **route delayed** (coordinator): pushes a
  message to that route's parents and pushes that route's pending
  deadlines back by the same number of minutes, so one late bus doesn't
  raise 50 escalations.
- **School closure** dates: no plan is generated.
- **A late scan** (for example, synced after a driver was offline): marks
  the row `met`, auto-resolves any open escalation for it, and tells
  everyone already alerted "Resolved: scan received at 7:52".

### 6.2 The escalation chain

| Level | When | Who is alerted | Channel |
|---|---|---|---|
| 1 | Deadline passed (within 30 s) | The student's guardians | High-priority push |
| 2 | +5 min, unresolved | Transport coordinator(s) | High-priority push |
| 3 | +10 min, unresolved | School admin(s) | High-priority push |
| 4 | +15 min, unresolved | Admin + coordinator get a **"Call police"** prompt: one tap opens the phone dialer with the school's configured number (default 112). Reminder every 5 min until resolved. | High-priority push |

There is no SMS fallback. That is why the chain keeps advancing on a
timer rather than waiting for anyone to read their phone: if a guardian's
push doesn't arrive, staff hear about it 5 minutes later anyway.

- A level with nobody assigned (for example, a school without a
  transport coordinator) is skipped.
- Coordinator and admin alerts are **grouped per vehicle and checkpoint**
  when more than 3 students on the same trip miss the same checkpoint
  ("Bus 12: 48 students not confirmed at the gate; bus last seen 3 min
  ago, 2 km away") instead of 48 separate pushes. Guardians always get
  their own child's alert.
- Every alert to a coordinator or admin includes the vehicle's last
  known position and how long ago it was seen, so "the bus is in a dead
  zone" is visible at a glance.
- **Resolving:** a matching scan resolves automatically. Any person
  alerted, including the guardian, can resolve with a reason (found
  safe, absent, alternate transport, other) and an optional note.
- **Police is never called automatically.** Tapping "Call police" and
  then "Police contacted" records who called and when. This is the
  human-in-the-loop decision from the full architecture (Assumption A9)
  and still needs legal sign-off.

Every level change, notification and resolution is an append-only row
(`escalation_events`, `notifications`), which is the audit trail.

## 7. Key flows

### 7.1 What happens when a card is scanned

**What the QR code holds:** `SS1:` followed by a random 26-character
token (128 random bits, base32), for example
`SS1:K7Q2M9XH4TRA6WZP3N8BCD5FGE`. `SS1` marks it as a Studesafe card,
format version 1, so the app can reject any other QR code. The token is
only a lookup key: no name, no school, no ID number. It means something
only to a signed-in Studesafe account that is allowed to see that
student; a photographed card gives a stranger random text. Reissuing a
lost card replaces the token and the old one stops working immediately.
History is stored against the student, not the token, so nothing is
lost.

**The flow, step by step:**

1. **Roster download (before scanning).** Each scanning phone keeps the
   names and tokens it may need, so step 3 works with no signal:
   - a driver's app downloads its trip's riders when the trip starts;
   - a gate staff app downloads the whole school's roster at the start of
     each day;
   - a parent's app keeps its own children's tokens.
2. **The camera reads the code.** The camera stays open and records each
   code as soon as it is decoded, with no tap. The same code within 10
   seconds is ignored, so holding a card up doesn't record it twice.
3. **The phone checks the code against its roster, in under a second,
   online or offline:**
   - **Match:** the student's name, a green flash and a beep.
   - **Not an `SS1` code, or a reissued token:** red screen, "Not a
     valid Studesafe card". Nothing is recorded.
   - **A driver scans a student not on this vehicle today:** red screen,
     "Not on this bus". The scan is still recorded with
     `flag = not_on_roster`, and the transport coordinator gets a push.
   - **A parent scans a child who isn't theirs:** rejected. Nothing is
     recorded.
4. **The checkpoint type comes from who is scanning, not from the card**
   (§6.1):
   - driver on an active AM trip → `board_am`; on a PM trip → `board_pm`;
   - gate staff → `gate_in` or `gate_out`, from their Arrival/Departure
     toggle;
   - parent → `home_depart` or `home_arrive`, preselected by time of day
     and changeable.
5. **The phone queues the scan** in `expo-sqlite` with a client-generated
   UUID, the scan time (`occurred_at`) and the phone's GPS position, then
   sends it with `POST /scans`. With no signal it waits and goes up in a
   batch when the connection returns.
6. **The server records it, in one database transaction:**
   - checks again that this account may record this student (the phone's
     check is for speed; the server's is the one that counts);
   - inserts the checkpoint; a UUID it has already seen is ignored, so
     retries and repeated batches can't double-count;
   - uses `occurred_at` for all deadline math if it falls between 24 h ago
     and 5 min in the future; otherwise it uses the server's time and
     flags the row;
   - marks the matching row in the student's day plan `met`;
   - resets the next checkpoint's deadline from the real scan time (for
     example, `gate_in` becomes due at boarding time + the rest of the
     trip + 15 min);
   - if an escalation is open for this checkpoint (the scan arrived late,
     say after the driver was offline), resolves it and queues a
     "Resolved: scan received at 7:52" push to everyone already alerted;
   - queues the guardians' push.
7. **The push goes out straight away.** The request triggers an immediate
   outbox drain (§5.4), so guardians get "Aryan boarded Bus 12 at 7:42 AM"
   within seconds, and that checkpoint turns green on their Today screen.

If a scan doesn't arrive by its deadline, the sweeper opens an
escalation instead (§7.2).

```mermaid
sequenceDiagram
    actor Driver
    participant App as Driver app
    participant API as API server
    participant DB as PostgreSQL
    participant FCM as FCM
    actor Parent

    Note over App: Trip start: roster (names + tokens) cached on the phone
    Driver->>App: Hold card to camera (boarding)
    App->>App: Match token against cached roster, show name + green flash (under 1 s, works offline)
    App->>App: Queue scan: client UUID, occurred_at, lat, lng
    App->>API: POST /scans (now, or as a batch when back online)
    API->>DB: One transaction: authorize, insert checkpoint (dedup on UUID), mark plan row met, reset next deadline, resolve any open escalation, queue pushes
    API-->>App: 200 OK
    API->>FCM: Drain outbox now
    FCM->>Parent: "Aryan boarded Bus 12 at 7:42 AM"
```

### 7.2 Missed checkpoint to escalation

```mermaid
sequenceDiagram
    participant SW as Sweeper (every 30 s)
    participant DB as PostgreSQL
    participant N as Outbox drain
    actor Parent
    actor Coordinator
    actor Admin

    SW->>DB: Claim pending rows past due_at, open escalation L1, queue alerts (one transaction)
    SW->>N: Drain
    N->>Parent: Push "No boarding confirmed for Aryan by 7:50"
    Note over SW,DB: 5 min later, still open
    SW->>DB: Advance to L2, queue alerts
    N->>Coordinator: Push with bus position
    Note over SW,DB: 5 min later, still open
    SW->>DB: Advance to L3
    N->>Admin: Push
    Note over SW,DB: 5 min later, still open
    SW->>DB: Advance to L4
    N->>Admin: "Call police" prompt (human decides, one tap to dial)
```

### 7.3 Live bus location

```mermaid
sequenceDiagram
    participant D as Driver app
    participant API as API server
    participant DB as PostgreSQL
    participant P as Parent app

    D->>API: POST /trips/:id/start
    loop every 30 s while trip is active
        D->>API: POST /trips/:id/locations (3 samples, 10 s apart)
        API->>API: Update latest position in memory, compute ETA per stop
        API->>DB: Insert pings (batched)
        API-->>P: WebSocket: position + ETA to subscribers of this vehicle
        API->>API: Within 1 km of a rider's stop? Queue one "bus approaching" push per rider per trip
    end
    P->>API: Open WebSocket only while the map screen is visible
```

**ETA** (no paid routing API): distance along the remaining stops
(straight-line segments × 1.3 road factor) divided by the vehicle's
rolling average speed over the last 5 minutes (floor 15 km/h). Shown as
"about 8 min". Good enough to decide when to walk to the stop; the
Routes API can replace it later if parents need traffic-aware ETAs.

## 8. Data model

Twenty small tables, sixteen of them drawn below. Every table that holds
school data carries `school_id`.

```mermaid
erDiagram
    SCHOOL ||--o{ USERS : has
    SCHOOL ||--o{ STUDENT : enrolls
    SCHOOL ||--o{ VEHICLE : operates
    STUDENT ||--o{ GUARDIAN : "linked by"
    USERS ||--o{ GUARDIAN : "is guardian in"
    VEHICLE ||--o{ ROUTE : runs
    ROUTE ||--o{ STOP : has
    STUDENT ||--o{ RIDER : "rides as"
    ROUTE ||--o{ RIDER : carries
    STOP ||--o{ RIDER : "boards or drops at"
    ROUTE ||--o{ TRIP : "runs daily as"
    TRIP ||--o{ LOCATION_PING : streams
    STUDENT ||--o{ EXPECTED_CHECKPOINT : "planned for"
    STUDENT ||--o{ CHECKPOINT : "scanned as"
    EXPECTED_CHECKPOINT ||--o| CHECKPOINT : "met by"
    EXPECTED_CHECKPOINT ||--o| ESCALATION : "missed, opens"
    ESCALATION ||--o{ ESCALATION_EVENT : logs
    USERS ||--o{ NOTIFICATION : receives
    USERS ||--o{ DEVICE : "pushes to"

    SCHOOL {
      uuid id PK
      text name
      text timezone
      time start_time
      time end_time
      int tolerance_min
      text emergency_phone
    }
    USERS {
      uuid id PK
      uuid school_id FK
      text phone
      text name
      text roles
      timestamptz consent_at
    }
    STUDENT {
      uuid id PK
      uuid school_id FK
      text name
      text grade_label
      text qr_token
      bool active
    }
    GUARDIAN {
      uuid student_id FK
      uuid user_id FK
    }
    VEHICLE {
      uuid id PK
      text kind
      text label
      uuid driver_user_id FK
    }
    ROUTE {
      uuid id PK
      uuid vehicle_id FK
      text direction
      time depart_time
      int trip_minutes
    }
    STOP {
      uuid id PK
      uuid route_id FK
      int seq
      text label
      float lat
      float lng
      int offset_min
    }
    RIDER {
      uuid student_id FK
      uuid route_id FK
      uuid stop_id FK
    }
    TRIP {
      uuid id PK
      uuid route_id FK
      date service_date
      timestamptz started_at
      timestamptz ended_at
    }
    LOCATION_PING {
      uuid trip_id FK
      timestamptz recorded_at
      float lat
      float lng
      float speed_kmh
    }
    EXPECTED_CHECKPOINT {
      uuid id PK
      uuid student_id FK
      date service_date
      text type
      timestamptz due_at
      text status
    }
    CHECKPOINT {
      uuid id PK
      uuid student_id FK
      text type
      timestamptz occurred_at
      timestamptz received_at
      uuid recorded_by FK
      uuid trip_id FK
      text flag
    }
    ESCALATION {
      uuid id PK
      uuid expected_id FK
      int level
      text status
      timestamptz next_step_at
      text resolution
    }
    ESCALATION_EVENT {
      uuid escalation_id FK
      timestamptz at
      text action
      uuid actor_id FK
      text note
    }
    NOTIFICATION {
      uuid id PK
      uuid user_id FK
      text template
      text priority
      text status
      int attempts
    }
    DEVICE {
      uuid user_id FK
      text fcm_token
      text platform
      bool notifications_enabled
      timestamptz last_seen_at
    }
```

Not drawn, to keep the diagram readable: `absences` (student, date,
part), `school_closures` (date), `otp_codes`, `refresh_tokens`. `roles` is
a PostgreSQL `text[]`, since one person can be both a parent and a
carpool driver.

**QR token:** 128 random bits, base32-encoded, stored on the student row
with a unique index. The printed QR encodes `SS1:<token>` and nothing
else. Reissuing a lost card replaces the token; history is keyed on
`student_id`, so nothing is lost.

## 9. Operations

### 9.1 Offline behaviour

- Every scanning phone caches the names and QR tokens it may need: a
  driver's trip riders at trip start, the whole school's roster on gate
  staff phones each day, and a parent's own children. A scan is
  validated and shown on screen instantly with no network (§7.1).
- Scans and GPS samples go into an `expo-sqlite` queue with a client
  UUID and client timestamp, and drain in batches when online. The server
  deduplicates on the UUID.
- An offline driver can cause a false missed-checkpoint alert. That is
  accepted: the late sync auto-resolves it and tells everyone alerted, and
  the coordinator's alert shows "bus last seen N min ago" so connectivity
  gaps are recognisable.

### 9.2 Security

- HTTPS only (Caddy obtains and renews certificates automatically). A
  DigitalOcean Cloud Firewall (free) opens 80 and 443 to everyone and SSH
  only to the team's IP addresses; SSH is key-only, with password login
  disabled.
- PostgreSQL is reachable only inside the Docker network.
- Access tokens (JWT) live 15 minutes; refresh tokens live 90 days, rotate
  on use, are stored hashed and can be revoked by an admin.
- OTP endpoints are rate-limited per phone number and per IP; codes are
  stored hashed and expire after 5 minutes.
- Authorization is checked on the server for every request and every
  WebSocket subscription: a driver sees only their vehicle's riders today,
  gate staff their school, a parent only their own children and only the
  vehicle carrying them today.
- Secrets (FCM service account, MSG91 key, JWT secret, database password)
  sit in a `.env` file readable only by root, never in git.

### 9.3 Privacy

- **Stored about a student:** name, optional grade label, QR token,
  checkpoint history. No photo, no ID-card image, no date of birth.
- **Stored about guardians and staff:** name and phone number (needed for
  login).
- **Locations:** route stops (placed by the school) and vehicle GPS during
  trips only. For carpools a stop may be a home; admins should place the
  pin at the gate or corner rather than the door where possible.
- **Consent:** on first login a guardian sees a consent screen (India DPDP
  Act 2023: processing a minor's data needs guardian consent); the
  timestamp and text version are stored.
- **Retention:** GPS pings 30 days. Checkpoint and escalation records are
  kept while the student is enrolled and deleted when the student is
  removed, matching the landing page's promise (see open question 4).
- **Where data lives:** the live database is on the droplet in Bangalore,
  so it stays in India. Backups go to Cloudflare R2, which has no
  India-only storage option; they are encrypted on the droplet before
  upload, so R2 only ever holds unreadable files. If a school requires
  every copy to stay in India, send backups to DigitalOcean Spaces in
  Bangalore instead (~$5/month).

### 9.4 Deployment, backups and monitoring

**Runtime:** one DigitalOcean **Basic droplet** (1 shared vCPU, 1 GB RAM,
25 GB SSD, 1 TB monthly transfer, public IPv4 included) in the Bangalore
region (`BLR1`), Ubuntu LTS with Docker. One `docker-compose.yml` with
three services: `caddy`, `api`, `postgres`. All restart automatically
(`restart: unless-stopped`). A 1 GB swap file is a safety net against
memory spikes. The expected footprint is about 600 MB (Node ~150 MB,
PostgreSQL ~200 MB, Caddy ~30 MB, the OS and 500 WebSocket connections
the rest); if memory use stays above 80%, resize the droplet to 2 GB
($12/month) in a couple of minutes, outside school hours.

**Deploy:** GitHub Actions runs type-check, lint and tests, builds the API
image (with the admin SPA baked in), then copies it straight to the
droplet over SSH (`docker save | ssh … docker load`), so there is no
container registry to pay for or log in to. It then runs `docker compose
up -d`. The previous image stays on the droplet for a one-command
rollback. Database migrations run on container start. Deploys happen
outside 06:00–17:00 on school days.

**Mobile builds:** EAS Build (free tier) for the dev and release builds;
EAS Update for JavaScript-only fixes without a store review. Android
pilot via the Play Console internal testing track; iOS via TestFlight
only if pilot parents need it.

**Backups:**

- `pg_dump` every 6 hours (a cron job on the droplet), compressed and
  encrypted with `age`, uploaded to a **Cloudflare R2** bucket through its
  S3-compatible API (`rclone`). An R2 lifecycle rule deletes dumps older
  than 30 days. Recovery point ≤ 6 h. At pilot size this stays inside
  R2's 10 GB free tier; if it grows past that, keep 14 days instead. The
  decryption key is kept offline by the team, never on the droplet.
- **DigitalOcean weekly droplet backups** (20% of the droplet price) keep
  a whole-machine copy, including Caddy's config and the `.env` file.
- A restore drill is part of pilot readiness (see requirements §7).

**Monitoring (all free tiers):**

- **Healthchecks.io** heartbeat: the sweeper pings it after every
  successful run. No ping for 2 minutes (process dead, database down or
  droplet off) alerts whoever is on call by email and phone app (Telegram
  or Slack). This is the main alarm.
- **UptimeRobot** checks `https://…/health` every 5 minutes from outside,
  catching what the heartbeat can't see: an expired certificate, a DNS
  problem or Caddy down.
- **DigitalOcean Monitoring** (built in) alerts on memory above 80%, disk
  above 80% and sustained high CPU.
- **Sentry** for app crashes and server errors.
- Structured JSON logs to stdout, read with `docker compose logs`; Docker
  log rotation caps them at a few hundred MB.

**Repository layout (monorepo):**

```
server/   Fastify API, sweeper, migrations, replay-a-day test script
app/      Expo app (all roles)
admin/    Vite + React admin SPA
deploy/   docker-compose.yml, Caddyfile, backup script, setup runbook
```

## 10. Cost

Approximate list prices (September 2026, before tax); verify at signup.

| Item | Choice | ≈ per month |
|---|---|---|
| Server | DigitalOcean Basic droplet, 1 GB, Bangalore (includes 25 GB SSD, public IPv4, 1 TB transfer) | $6 |
| Whole-machine backups | DigitalOcean weekly droplet backups (20% of droplet price) | $1.20 |
| Database backups | Cloudflare R2, within the 10 GB free tier | $0 |
| Container images | None: built in CI, copied over SSH | $0 |
| Firewall, server metrics | DigitalOcean Cloud Firewall and Monitoring | $0 |
| Alerts | Healthchecks.io + UptimeRobot free tiers | $0 |
| Push | Firebase Cloud Messaging | $0 |
| Maps | Mobile SDK map loads unbilled; admin web within free cap; no routing/geocoding calls | $0 |
| Error tracking | Sentry free tier | $0 |
| Mobile builds | EAS free tier | $0 |
| **Infrastructure total** | | **≈ $7–8** |
| SMS | Login codes only: ~20–50/day, plus a one-off ~1,000 when parents first sign in; ~₹0.20 each | ≈ ₹100–250 (~$1–3) |

**One-time or yearly:** domain (~$12/yr), Google Play developer account
($25 once), Apple Developer Program ($99/yr, only if iOS is in the pilot),
DLT registration for the SMS sender ID and the OTP template (one-time
fee, varies by telecom operator portal).

**Every notification is a push, which is free.** SMS is used only for
login codes, and logins are rare because sessions last 90 days. For
comparison, sending escalation alerts by SMS would have added ~₹450–700 a
month, and SMS on every routine checkpoint ~₹22,000 a month.

**Why DigitalOcean over GCP:** the same setup on the smallest workable GCP
machine in Mumbai (e2-micro or e2-small) comes to about $17–30 a month,
because GCP bills the public IP address, disk and backups separately.
DigitalOcean's droplet price includes them. The only paid step up at
pilot scale is resizing to the 2 GB droplet ($12/month) if memory gets
tight.

## 11. Limitations

### 11.1 Limits of the design

- **A scan proves the card was present, not the child.** A scan proves
  the card, or a photo of it, was in front of an authorised adult's
  phone, not that the child was. The system relies on the adult scanning
  actually looking at the child, which is true for drivers and gate
  staff. It's the one weak point of cards over biometrics, and it's why
  only signed-in, authorised accounts can record scans, each logged with
  who scanned and where.

### 11.2 Prototype limits and when to upgrade

| Limit accepted in the prototype | Upgrade when | Upgrade to |
|---|---|---|
| One droplet: no automatic failover. Target 99.5% during school hours; a host failure means restoring onto a new droplet from the latest backup (~30 min). | A paying contract or a second school | DigitalOcean Managed PostgreSQL (daily backups and point-in-time recovery, from ~$15/month) + two droplets behind a DigitalOcean Load Balancer, or the full GCP architecture. The sweeper's advisory lock already allows two API instances. |
| 1 GB of memory | Memory use stays above 80% (DigitalOcean Monitoring alert) | Resize to the 2 GB droplet ($12/month), a few minutes' downtime outside school hours |
| Push is the only alert channel: a phone that is off, offline or has notifications disabled misses its alert (the chain still advances to staff on a timer) | The pilot shows escalation pushes going unseen, or a school requires a second channel | SMS for escalation levels (~₹450–700/month at this scale; the outbox already supports adding a channel) |
| In-memory WebSocket fan-out works for one process only | A second API instance | PostgreSQL `LISTEN/NOTIFY` (no new service) or Redis pub/sub |
| Live position is up to ~30–45 s old | Parents ask for smoother tracking | Upload every 10 s (triples GPS requests, still far under capacity) |
| Straight-line ETA | Parents report bad ETAs | Google Routes API (billed per request) |
| Phone-camera scanning only | A school wants its biometric gate or attendance system to count | Integration adapter module (full architecture §4.9) |
| Single school, no super-admin console | Second school | Tenant provisioning screen; the schema is already multi-school |
| `.env` secrets, no IaC | More than one environment or engineer on call | A managed secrets store, Terraform (it has a DigitalOcean provider) |
| Throughput ~20–50× peak | Sustained > 50 req/s or > 5,000 concurrent map viewers | The full architecture on GCP: Cloud Run or GKE, Redis, a message bus |

## 12. Differences from the landing page and open questions

The landing page (`website` branch) is the most recent description of the
product, so the prototype follows it where it differs from the full-scale
docs:

- **Parents scan at home** (`home_depart`, `home_arrive`); the full docs
  had no parent scan.
- **No bus-alight scans**; the full docs had `bus_alight`.
- **Classroom checkpoint** is optional on the site and **out of scope**
  here (it depends on the school's attendance system).
- **Parents can stop an escalation** for their own child (FAQ), included.

Open questions for the team:

1. **SMS on the landing page.** The prototype sends no SMS notifications
   (login codes only), but the site still promises SMS in two places: the
   "Notifications & escalation" service ("App notification and SMS to
   parents the moment a checkpoint happens") and the "Signal received"
   example ("Parents notified instantly on Studesafe mobile app and
   SMS"). The copy should say "app notification" only.
2. **"No PII except name."** The site says Studesafe stores no
   personally identifiable information except the student's name. The
   system must also store guardians' phone numbers (for login) and
   stop locations (which can be a home for carpools). Suggest rewording to
   "no personal information about the student except their name".
3. **Missed `home_arrive`.** If a parent isn't home to scan, they get an
   alert and must tap "Resolve". Useful as a nudge, but it may produce
   daily coordinator noise if parents ignore it. Watch this in the pilot;
   the chain for this checkpoint could stop at level 2.
4. **Retention vs. audit.** Deleting a student's records when they leave
   matches the site's promise but removes the evidence trail if an
   incident is disputed later. Needs a legal decision (full-architecture
   Assumption A13).
5. **Police step** stays human-triggered (full-architecture A9); legal
   sign-off still needed.
6. **Language.** English at launch with strings kept in one file per
   language. Add Hindi for the driver and gate screens before the pilot if
   the pilot's drivers need it.

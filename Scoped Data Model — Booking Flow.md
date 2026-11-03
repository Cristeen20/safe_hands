# Scoped Data Model — Booking Flow

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Date** | 2026-11-02 |
| **Database** | PostgreSQL |
| **Scope** | Only the request → approval → assign → pay → dashboard → cancel → change-helper flow |
| **Full model** | [Elder Care Home-Service Booking — Data.md](./Elder%20Care%20Home-Service%20Booking%20—%20Data.md) |

This is a cut-down version of the full data model. It uses the four tables from the hand-drawn model (users, services, bookings, dashboard) and adds only the columns the booking flow below needs. Everything else (care recipients, visits, payouts, reviews, recurring schedules) is out of scope here and stays as defined in the full model.

---

## 1. Actors

| Actor | Who | In this flow |
|---|---|---|
| **Customer** | The person booking (for themself or someone they care for) | Picks a date and time from the ones with a free helper, submits a request, accepts a quote, pays, pays an extra bill if the job runs over, views their dashboard, cancels a booking |
| **Backend** | The server | Lists the dates and times a helper is free, prices the request, asks for payment, auto-assigns an available employee once an auto-approved request is paid, records status, serves dashboards, applies cancellations, lists available helpers |
| **Admin** | Platform operator | Approves with a quote and an available helper (or denies), changes a helper if needed, is alerted when a job runs over and acts on it, views their dashboard |
| **Employee** | The helper doing the job | Is assigned (can't decline), updates the job status in the app, reports when a job runs over and calls the admin, and is released when a booking is cancelled |

---

## 2. Flow diagram

Before either path, the customer **picks a date and time**. The backend only offers slots where at least one helper is available for the whole job (from leaving base to getting back) and any break after it (**0**, see [7](#7-helper-assignment-and-availability)).

Then there are two paths, chosen by the backend when the request is submitted:

- **A. Auto-approved**: the pricing rules can price the request (D28) **and the helper's whole effort is 9 hours or less**. No admin step.
- **B. Needs admin approval**: everything else: **more than 9 hours of effort**, no pricing rule, routing failure…

**Multi-day bookings are out of scope** for now: every booking in this model is a single job on one day.

The **effort** is all the helper's time on the job, from leaving our base to getting back to it:

```
base → pickup  +  pickup → destination  +  destination → pickup (if a return is booked)  +  back to base  +  service hours
```

Who assigns the helper depends on the path (see [7](#7-helper-assignment-and-availability)):

- **A:** the backend assigns an available helper **automatically, once the customer has paid**. Nobody is assigned to an unpaid request.
- **B:** the **admin picks an available helper as part of approving**, together with the quote. The backend never auto-assigns these.

An admin can **change the helper** on any open booking later (**D**).

Every booking must be **confirmed (paid) at least 48 hours before its start**. After that point it can't be paid and expires.

Within that limit, the customer has **48 hours** from the quote (or from submitting, in path A) to accept and pay. If they pay after those 48 hours, the backend checks again for a free helper before taking the money (**E**): if one is free the booking goes ahead with them, and if not the customer is asked to send a new request.

Either path can end in **C. Cancellation**: the customer cancels from their dashboard.

Helpers can't decline a job. If a job **runs over**, the backend **alerts the admin**: when the job is late, when the helper's 8-hour break is coming up, and when the helper won't make their next appointment. The admin then gives the next appointment to another helper or cancels it (**F**). The customer whose job ran over gets an **extra bill** for the extra hours.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant B as Backend
    actor A as Admin
    actor E as Employee

    rect rgb(240, 236, 248)
    Note over C,B: 0. Choosing a date (both paths)
    C->>B: Date & time step (service, route, hours)
    B->>B: Work out effort (base → … → base) and break
    B-->>C: Dates and times with at least one free helper
    C->>B: Pick a slot
    end

    rect rgb(227, 238, 234)
    Note over C,E: A. Auto-approved (pricing rules can price it)
    C->>B: Submit request
    B->>B: Re-check a helper is still free
    B-->>C: Payment request
    C->>B: Pay
    B->>E: Auto-assign available employee
    B-->>A: Shows in "Approved" on admin dashboard
    end

    rect rgb(253, 243, 220)
    Note over C,E: B. Needs admin approval
    C->>B: Submit request
    B->>B: Re-check a helper is still free
    B-->>A: Request for approval ("To be approved")
    A->>B: Get available helpers for this booking
    B-->>A: Available helpers
    A->>B: Approve: quote + chosen helper
    B->>E: Assign employee
    B-->>C: Approval (quote)
    C->>B: Accept quote
    B-->>C: Payment request
    C->>B: Pay
    B-->>A: Shows in "Approved" on admin dashboard
    end

    rect rgb(242, 243, 239)
    Note over C,A: Dashboards
    C->>B: Open dashboard
    B-->>C: Approved services + pending approval + denied
    A->>B: Open dashboard
    B-->>A: Approved + to be approved
    end

    rect rgb(250, 228, 224)
    Note over C,E: C. Cancellation (from the customer dashboard)
    C->>B: Cancel booking (with reason)
    B->>B: Set status to cancelled
    B-->>E: Release employee
    B-->>A: Shows in "Cancelled" on admin dashboard
    B-->>C: Shows in "Cancelled" on customer dashboard
    end

    rect rgb(232, 236, 245)
    Note over B,E: D. Admin changes the helper (optional, any open booking)
    A->>B: Get available helpers for this booking
    B-->>A: Helpers with no overlapping task or break
    A->>B: Change helper to the one picked
    B-->>E: Release the old employee
    B->>E: Assign the new employee
    end

    rect rgb(255, 238, 214)
    Note over C,E: E. Paying after the 48-hour window
    B-->>E: At 48 h: release the held employee (path B)
    C->>B: Pay
    B->>B: Re-check available helpers
    alt Less than 48 h before the start
        B-->>C: "Too late to confirm. Please send a new request."
        B->>B: Status expired
    else A helper is free
        B->>E: Assign available employee (fewest hours)
        B-->>C: Payment page
        C->>B: Pay
        B-->>A: Shows in "Approved" on admin dashboard
    else No helper is free
        B-->>C: "No helper is free for this time. Please send a new request."
        B->>B: Status expired
    end
    end

    rect rgb(236, 230, 222)
    Note over C,E: F. Job runs over
    alt Helper reports it
        E->>B: Update status: running over + new expected end
    else Helper doesn't report it
        B->>B: Check every 10 min: job past its planned end, not completed
    end
    B->>B: Extend the job; work out break and next appointment
    B-->>A: Admin view alert: running over
    opt Effort will pass 9 h
        B-->>A: Admin view alert: 8-hour break coming up
    end
    opt Not enough time before the next appointment
        B-->>A: Admin view alert: change helper or cancel next appointment
    end
    E->>A: Calls the admin
    alt Another helper is free
        A->>B: Assign a new helper to the next appointment
        B->>E: Assign the new employee
    else Nobody can take it
        A->>B: Cancel the next appointment
        B-->>C: Next appointment's customer is told it's cancelled
    end
    E->>B: Job completed (back at base)
    B->>B: Extra hours × overrun rate
    B-->>C: Extra bill (late job's customer)
    C->>B: Pay extra bill
    B-->>A: Extra bill paid
    end
```

Plain-text version (same flow):

```
 CUSTOMER                 BACKEND                    ADMIN                  EMPLOYEE
    │                        │                         │                        │
 0. Choosing a date (both paths)
    │── date & time step ───►│  effort + break         │                        │
    │   (service, route,     │  → slots with ≥ 1       │                        │
    │    hours)              │    free helper          │                        │
    │◄─── available slots ───│                         │                        │
    │── pick a slot ────────►│                         │                        │
    │                        │                         │                        │
 A. Auto-approved
    │── submit request ─────►│  re-check helper free   │                        │
    │◄──── payment request ──│                         │                        │
    │── pay ────────────────►│── auto-assign employee ─┼───────────────────────►│
    │                        │── approved (dashboard) ►│                        │
    │                        │                         │                        │
 B. Needs admin approval
    │── submit request ─────►│  re-check helper free   │                        │
    │                        │── request approval ────►│                        │
    │                        │◄─ get available helpers─│                        │
    │                        │── available helpers ───►│                        │
    │                        │◄─ approve: quote+helper─│                        │
    │◄─────────── approval ──│── assign employee ──────┼───────────────────────►│
    │── accept quote ───────►│                         │                        │
    │◄──── payment request ──│                         │                        │
    │── pay ────────────────►│── approved (dashboard) ►│                        │
    │                        │                         │                        │
 Dashboards
    │── open dashboard ─────►│                         │                        │
    │◄─ approved + pending ──│◄──── open dashboard ────│                        │
    │      + denied          │── approved + to be ────►│                        │
    │                        │      approved           │                        │
    │                        │                         │                        │
 C. Cancellation
    │── cancel booking ─────►│── status = cancelled    │                        │
    │   (from dashboard)     │── release employee ─────┼───────────────────────►│
    │                        │── cancelled (dashboard)►│                        │
    │◄─ cancelled (dashboard)│                         │                        │
    │                        │                         │                        │
 D. Admin changes the helper
    │                        │◄─ get available helpers─│                        │
    │                        │── available helpers ───►│                        │
    │                        │◄──────── change helper ─│                        │
    │                        │── release old employee ─┼───────────────────────►│
    │                        │── assign new employee ──┼───────────────────────►│
    │                        │                         │                        │
 E. Paying after the 48-hour window
    │                        │── at 48 h: release ─────┼───────────────────────►│
    │                        │   held employee (B)     │                        │
    │── pay ────────────────►│  re-check helpers       │                        │
    │                        │                         │                        │
    │  helper free:          │── assign employee ──────┼───────────────────────►│
    │◄──── payment page ─────│   (fewest hours)        │                        │
    │── pay ────────────────►│── approved (dashboard) ►│                        │
    │                        │                         │                        │
    │  no helper free:       │                         │                        │
    │◄─ "please send a new ──│  status = expired       │                        │
    │    request"            │                         │                        │
    │                        │                         │                        │
    │  < 48 h before start:  │  (no payment taken)     │                        │
    │◄─ "too late, please ───│  status = expired       │                        │
    │    send a new request" │                         │                        │
    │                        │                         │                        │
 F. Job runs over
    │                        │◄────────────────────────┼─ running over + new ───│
    │                        │  (or found by the       │   expected end         │
    │                        │   10-minute check)      │                        │
    │                        │  extend job, work out   │                        │
    │                        │  break + next appt      │                        │
    │                        │── alert: running over ─►│                        │
    │                        │── alert: break due ────►│  (if effort > 9 h)     │
    │                        │── alert: next appt at ─►│  (if it now overlaps)  │
    │                        │   risk                  │◄────── phone call ─────│
    │                        │◄─ new helper for next ──│                        │
    │                        │   appt, or cancel it    │                        │
    │◄─ next appt cancelled ─│  (if cancelled)         │                        │
    │                        │◄────────────────────────┼──── job completed ─────│
    │                        │  extra hours ×          │                        │
    │                        │  overrun rate           │                        │
    │◄──── extra bill ───────│                         │                        │
    │── pay extra bill ─────►│── extra bill paid ─────►│                        │
```

---

## 3. Tables

Four tables from the hand-drawn model, plus `admin_alerts`:

| # | Table | Purpose in this flow |
|---|---|---|
| 1 | `users` | Customers, admins and employees (helpers), one table with a `role` |
| 2 | `services` | The service catalog: driver, hospital visit, companion, property… |
| 3 | `bookings` | One row per booking: route, date and time, approval status, price, payment, helper |
| 4 | `dashboard` | One row per booking on a user's dashboard, with the "booking accepted" and "helper assigned" flags |
| 5 | `admin_alerts` | Alerts to admins when a job runs over: late, break coming up, next appointment at risk. Not in the sketch; added for this flow |

```
users ──1:*── bookings ──*:1── services
  │              │
  │              └──1:1── dashboard
  └──1:*── dashboard            (a user "owns" book1, book2, …)

users (role = employee) ──1:*── bookings.helper_id

bookings ──1:*── admin_alerts (booking_id = the late job, next_booking_id = the one at risk)
```

### IDs

The sketch uses readable IDs that show who owns what:

| ID | Format | Example | Meaning |
|---|---|---|---|
| `user_id` | `NN` | `01` | User 01 |
| `booking_id` | `<user_id>_<seq>` | `01_02` | User 01's second booking |
| `dash_id` | `dash_<booking_id>` | `dash_01_02` | Dashboard row for booking `01_02` |
| `service_id` | `ser_NN` | `ser_01` | Driver |

---

## 4. Table definitions

Columns marked **(sketch)** are from the hand-drawn tables. The others are added so the table can carry the flow (approval, quote, payment, helper, cancellation). Money is integer minor units plus an ISO currency code; times are `TIMESTAMPTZ` in UTC.

### `users`

| Column | Type | Nullable | Description |
|---|---|---|---|
| user_id | VARCHAR(10) | No | PK **(sketch)** |
| role | `customer` \| `admin` \| `employee` | No | |
| name | VARCHAR(150) | No | |
| email | VARCHAR(255) | Yes | Unique. Required before a customer can be quoted (D25) |
| phone | VARCHAR(20) | Yes | Unique, E.164 |
| created_at | TIMESTAMPTZ | No | |

### `services`

| Column | Type | Nullable | Description |
|---|---|---|---|
| service_id | VARCHAR(10) | No | PK **(sketch)** |
| service_type | VARCHAR(30) | No | **(sketch)** `driver`, `hospital_visit`, `companion`, `property`… (D26) |
| service_hrs | NUMERIC(4,1) | Yes | **(sketch)** Default length, e.g. 2 h for a driver. The booking can override it |
| description | TEXT | No | **(sketch)** What the service includes |
| auto_priced | BOOLEAN | No | Whether the pricing rules can price it (path A). True for driver and hospital visit (D28) |
| overrun_rate | INTEGER | Yes | Charge per extra hour: the **same as the service's normal hourly rate**, with nothing added (minor units, per currency in config). Hospital visit 500/hr, driver 100/hr with no per-km charge (D28). NULL = the service has no hourly rate, so an admin sets it with the quote |

Example rows (from the sketch):

| service_id | service_type | service_hrs | description |
|---|---|---|---|
| ser_01 | driver | 2 | Two-way drive to a location |
| ser_02 | hospital_visit | | Hospital visit (e.g. Ernakulam hospital) |
| ser_03 | companion | | Companion |
| ser_04 | property | | Property management |

### `bookings`

| Column | Type | Nullable | Description |
|---|---|---|---|
| booking_id | VARCHAR(20) | No | PK **(sketch)** |
| user_id | VARCHAR(10) | No | FK → users. The customer who booked |
| service_id | VARCHAR(10) | No | FK → services **(sketch)** |
| pickup | TEXT | Yes | **(sketch)** Start point; route services only |
| destination | TEXT | No | **(sketch)** Where the service happens |
| date_time | TIMESTAMPTZ | No | **(sketch)** Scheduled start, at least 48 h after submit (D17) |
| service_hrs | NUMERIC(4,1) | Yes | Hours for this booking, if not the service default |
| job_starts_at | TIMESTAMPTZ | No | When the helper leaves our base: `date_time` − drive time from base to the pickup (or service location) |
| ends_at | TIMESTAMPTZ | No | When the helper is back at base: after the service hours, the return (if booked) and the drive back to base |
| effort_hrs | NUMERIC(4,1) | No | `ends_at` − `job_starts_at`. 9 or less can be auto-approved; more needs an admin |
| blocked_until | TIMESTAMPTZ | No | When the helper is free again: `ends_at` + 8 h break if `effort_hrs` is more than 9, else `ends_at`. See [7](#7-helper-assignment-and-availability) |
| job_status | `scheduled` \| `in_progress` \| `running_over` \| `completed` | No | Set by the helper in the app. Default `scheduled` |
| expected_end_at | TIMESTAMPTZ | Yes | The helper's new estimate of when they'll be back at base, when `running_over` |
| planned_ends_at | TIMESTAMPTZ | No | The original `ends_at`, kept when an overrun pushes `ends_at` later. Extra hours are counted from here |
| completed_at | TIMESTAMPTZ | Yes | When the helper marked the job completed (back at base) |
| overrun_rate | INTEGER | No | Charge per extra hour, copied from `services.overrun_rate` when the booking is quoted (an admin enters it only when the service has none). Shown to the customer before they pay |
| overrun_hrs | NUMERIC(4,1) | Yes | `completed_at` − `planned_ends_at`, rounded up to the next 0.5 h. NULL = no overrun |
| overrun_amount | INTEGER | Yes | `overrun_hrs` × `overrun_rate`, same currency as the booking |
| overrun_status | `none` \| `due` \| `paid` \| `waived` | No | Default `none` |
| overrun_payment_ref | VARCHAR(100) | Yes | Unique. Provider's payment ID for the extra bill |
| approval_status | booking_status | No | **(sketch)** See [5](#5-status-lifecycle) |
| approval_mode | `auto` \| `admin` | No | Set by the backend at submit: `auto` = path A, `admin` = path B |
| quote_amount | INTEGER | Yes | Set by the backend (path A) or an admin (path B) |
| currency | CHAR(3) | No | Follows the customer's site (D21) |
| quoted_by | VARCHAR(10) | Yes | FK → users (admin). NULL = backend |
| confirm_by | TIMESTAMPTZ | No | `date_time` − 48 h. The last moment the booking can be paid and confirmed |
| pay_by | TIMESTAMPTZ | Yes | Quote time + 48 h (path A: submit time + 48 h). Until then the price and, in path B, the helper are held. See [7](#7-helper-assignment-and-availability) |
| payment_status | `unpaid` \| `paid` \| `late` | No | `late` = paid after cancel or expiry (D24) |
| payment_ref | VARCHAR(100) | Yes | Unique. Provider's payment ID; makes confirmation idempotent |
| helper_id | VARCHAR(10) | Yes | FK → users (employee). NULL = not assigned yet ("pending" in the sketch) |
| helper_source | `auto` \| `admin` | Yes | `auto` = the backend picked them after payment (path A); `admin` = an admin picked them when approving (path B) or changed them |
| denial_reason | TEXT | Yes | Required when `denied`; shown to the customer (D23) |
| cancelled_at | TIMESTAMPTZ | Yes | |
| cancelled_by | VARCHAR(10) | Yes | FK → users: the customer, or an admin (e.g. when the previous job ran over) |
| cancellation_reason | TEXT | Yes | Shown to the other side: the admin, or the customer when an admin cancels |
| created_at, updated_at | TIMESTAMPTZ | No | |

Example row (from the sketch):

| booking_id | service_id | pickup | destination | date_time | approval_status |
|---|---|---|---|---|---|
| 01_01 | ser_01 | Thiruvalla | Kottayam | 12 Dec, 10:00 | confirmed ("approved") |

### `dashboard`

| Column | Type | Nullable | Description |
|---|---|---|---|
| dash_id | VARCHAR(25) | No | PK **(sketch)** |
| user_id | VARCHAR(10) | No | FK → users **(sketch)** |
| booking_id | VARCHAR(20) | No | FK → bookings, unique **(sketch)** |
| book_accept | BOOLEAN | No | **(sketch)** Yes once the booking is approved: by the backend (path A) or an admin's quote (path B) |
| helper_accept | BOOLEAN | No | **(sketch)** Yes once a helper is assigned. Helpers can't decline, so assignment is acceptance |
| section | `approved` \| `pending` \| `denied` \| `cancelled` | No | Which dashboard section shows it (see [6](#6-dashboards)) |
| updated_at | TIMESTAMPTZ | No | |

Example rows (from the sketch):

| user_id | dash_id | booking_id | book_accept | helper_accept |
|---|---|---|---|---|
| 01 | dash_01_01 | 01_01 | yes | yes |
| 01 | dash_01_02 | 01_02 | no | no |
| 02 | dash_02_01 | 02_01 | yes | no |

The backend writes `bookings` and `dashboard` in the **same transaction**, so the two can't disagree.

### `admin_alerts`

One row per alert, so each is sent once and the admin can see what's still open.

| Column | Type | Nullable | Description |
|---|---|---|---|
| alert_id | UUID | No | PK |
| kind | `running_over` \| `break_due` \| `next_at_risk` | No | See [7](#7-helper-assignment-and-availability) |
| booking_id | VARCHAR(20) | No | FK → bookings. The job that's running over |
| next_booking_id | VARCHAR(20) | Yes | FK → bookings. The helper's next appointment at risk (`next_at_risk` only) |
| helper_id | VARCHAR(10) | No | FK → users (employee) |
| message | TEXT | No | E.g. "Anil is 2 h late on 01_01 and can't reach 02_01 at 15:00" |
| created_at | TIMESTAMPTZ | No | |
| resolved_at | TIMESTAMPTZ | Yes | NULL = still open |
| resolved_by | VARCHAR(10) | Yes | FK → users (admin). NULL = resolved by the backend |
| resolution | `new_helper` \| `cancelled` \| `job_finished` \| `dismissed` | Yes | |

**Unique:** `(kind, booking_id, next_booking_id)` while open, so a repeat check doesn't send the same alert twice.

---

## 5. Status lifecycle

`bookings.approval_status` (`booking_status`):

```
                       ┌── approval_mode = auto ──▶ awaiting_payment ──pay──▶ confirmed ──▶ helper auto-assigned
submit ──▶ (backend) ──┤                                   │
                       │                                   └──late pay, no helper free──▶ expired
                       │
                       └── approval_mode = admin ─▶ pending_approval
                                                       │
                                ┌──admin denies────────┤
                                ▼                      │ admin approves with quote
                             denied                    │ + picks an available helper
                                                       ▼
                                                    quoted ──customer declines──▶ declined
                                                       │   └──late pay, no helper free──▶ expired
                                                       │ customer accepts
                                                       ▼
                                                   accepted ──pay──▶ confirmed
                                                       └──late pay, no helper free──▶ expired

At confirm_by (48 h before the start) every unpaid booking becomes expired and its helper is released.
At pay_by (48 h after the quote) nothing changes status: path B's held helper is released, and the booking can still be paid
if a helper is free when the customer pays.

Cancellation (customer, from the dashboard), from any open status:

pending_approval ─┐
quoted ───────────┤
accepted ─────────┼──customer cancels──▶ cancelled ──▶ helper released
awaiting_payment ─┤
confirmed ────────┘
```

`bookings.job_status` (set by the helper, on confirmed bookings):

```
scheduled ──start──▶ in_progress ──finish──▶ completed
                         │   ▲
              runs over  ▼   │ (still counts as in progress)
                     running_over ──finish──▶ completed
```

What each step writes:

| Step | `bookings` | `dashboard` |
|---|---|---|
| Submit (path A) | `awaiting_payment`, `quote_amount`, `pay_by`, `job_starts_at`, `ends_at`, `effort_hrs`, `blocked_until` | new row: `book_accept = yes`, `section = pending` |
| Submit (path B) | `pending_approval`, `job_starts_at`, `ends_at`, `effort_hrs`, `blocked_until` | new row: `book_accept = no`, `section = pending` |
| Admin approves (path B) | `quoted`, `quote_amount`, `quoted_by`, `pay_by`, `helper_id`, `helper_source = admin` | `book_accept = yes`, `helper_accept = yes` |
| Customer accepts (path B) | `accepted` | |
| Pay | `confirmed`, `payment_status = paid`, `payment_ref` | `section = approved` |
| Pay, path A only | `helper_id` (auto), `helper_source = auto` | `helper_accept = yes` |
| Admin changes helper | `helper_id` = new helper, `helper_source = admin` | `helper_accept = yes` |
| Helper starts the job | `job_status = in_progress` | |
| Helper reports running over, or the check finds it | `job_status = running_over`, `expected_end_at`, `ends_at` and `blocked_until` pushed later | new `admin_alerts` rows (see [7](#7-helper-assignment-and-availability)) |
| Helper finishes | `job_status = completed`, `completed_at` | |
| Finished late | `overrun_hrs`, `overrun_amount`, `overrun_status = due` | customer sees **Extra bill due** |
| Extra bill paid | `overrun_status = paid`, `overrun_payment_ref` | |
| Admin waives extra bill | `overrun_status = waived` | |
| Admin cancels the next appointment | on that booking: `cancelled`, `cancelled_by` = admin, `cancellation_reason`, `helper_id = NULL` | `section = cancelled` |
| Admin denies | `denied`, `denial_reason`, `helper_id = NULL` | `section = denied` |
| 48 h pass, unpaid (path B) | `helper_id = NULL` (status unchanged) | `helper_accept = no` |
| Late pay, helper free | `helper_id` (fewest hours), `helper_source = auto`, then as **Pay** | |
| Late pay, no helper free | `expired` | `section = denied` |
| `confirm_by` passes, unpaid | `expired`, `helper_id = NULL` | `section = denied` |
| Declined | `declined`, `helper_id = NULL` | `section = denied` |
| Cancel | `cancelled`, `cancelled_at`, `cancellation_reason`, `helper_id = NULL` | `section = cancelled`, `helper_accept = no` |

Setting `helper_id = NULL` is what **releases the helper**.

---

## 6. Dashboards

Both dashboards read the `dashboard` table, joined to `bookings` for the details.

### Customer dashboard (`dashboard.user_id = me`)

| Section | `section` | Shows |
|---|---|---|
| **Approved services** | `approved` | Paid bookings, with the helper's job status. A booking with `overrun_status = due` shows **Extra bill due** and a **Pay** button |
| **Pending approval** | `pending` | Waiting on an admin, the customer's accept, or payment |
| **Denied** | `denied` | Denied (with reason), declined or expired |
| **Cancelled** | `cancelled` | Bookings the customer cancelled, or an admin cancelled (with the reason) |

Bookings under **Approved services** and **Pending approval** show a **Cancel booking** button.

### Admin dashboard (all users)

| Section | Filter | Shows |
|---|---|---|
| **Approved** | `section = approved` | Paid bookings; `helper_accept = no` means no helper is assigned yet |
| **Extra bills** | `overrun_status = due` | Unpaid extra bills, with a **Waive** button |
| **Alerts** | open `admin_alerts` | Jobs running late, breaks coming up, and next appointments at risk, each with **Change helper** and **Cancel appointment** buttons. Shown at the top, and in the header bell on every admin page |
| **To be approved** | `bookings.approval_status = pending_approval` | Requests waiting for a quote or denial |
| **Cancelled** | `section = cancelled` | With the reason and when |

---

## 7. Helper assignment and availability

### Who assigns

| When | Who | How |
|---|---|---|
| Path A, when the payment succeeds | Backend | Picks the available helper with the **fewest hours** (below), in the same transaction that confirms the booking. Sets `helper_source = auto` |
| Path B, when approving | Admin | Fetches the available list, picks a helper and sends the quote in one action. Approval is refused without a helper. Sets `helper_source = admin` |
| Any time the booking is open | Admin | Fetches the available list, picks a different helper. Sets `helper_source = admin` |

Unpaid auto-approved requests (`awaiting_payment`) and requests waiting for approval (`pending_approval`) have no helper, so they never block anyone.

The availability check runs **before** any money is taken, so a path A customer is never charged without a helper (see the 48-hour window below).

Helpers **can't decline** an assignment.

### When a helper is busy

Each booking blocks its helper for a window:

```
job_starts_at ── base→pickup ── date_time ── service + drives ── back to base = ends_at ── 8 h break (effort > 9 h) ── blocked_until
              └───────────────────────────── effort_hrs ─────────────────────────────┘
```

- **Effort:** from leaving base (`job_starts_at`) to getting back to base (`ends_at`): base → pickup, pickup → destination, the return if booked, back to base, and the service hours. Counted per job, not added up across a day.
- **Break:** a job of **more than 9 hours** of effort (always admin-approved) is followed by an **8-hour break** after the service, once the helper is back at base. Jobs of 9 hours or less have no break, so `blocked_until = ends_at`.
- **No travel gaps needed:** every job starts and ends at our base, and the drives to and from base are inside the effort, so back-to-back jobs never leave a helper short of travel time.

A helper is **available** for a booking when its whole window (task + its own break) doesn't overlap any window (task + break) of the helper's other open bookings. Two windows overlap when each starts before the other ends.

Example (an admin-approved job of 10 h effort, followed by its break):

```
Booking 01_01   08:00 ━━━━━━━━━━ effort 10 h ━━━━━━━━━━ 18:00 ┄┄┄┄ break 8 h ┄┄┄┄ 02:00
New job leaving base at 20:00                                ✗ overlaps the break
New job leaving base at 02:00                                                       ✓ available
```

A short task before a long one also counts: the new booking's own break must not run into a task the helper already has.

### Query

Available helpers for booking `:b` (with window `:start` = `job_starts_at`, `:until` = `blocked_until`):

```sql
SELECT u.user_id, u.name
FROM users u
WHERE u.role = 'employee'
  AND NOT EXISTS (
    SELECT 1
    FROM bookings o
    WHERE o.helper_id = u.user_id
      AND o.booking_id <> :b                 -- ignore the booking being (re)assigned
      AND o.approval_status IN ('awaiting_payment', 'pending_approval',
                                'quoted', 'accepted', 'confirmed')
      AND o.job_starts_at < :until           -- other job starts before our window ends
      AND o.blocked_until > :start           -- and ends (with its break) after ours starts
  );
```

Only open bookings block a helper; denied, declined, expired and cancelled ones don't. Index: `bookings (helper_id, job_starts_at)`.

### Fewest hours first

The available list is sorted by each helper's **booked hours in the same week as the booking** (Monday to Sunday, India time), fewest first:

- **Hours** = `effort_hrs` of the helper's open bookings that week. Breaks don't count.
- **Ties** go to the lower `user_id`.
- The **backend** (path A) takes the first helper on the list.
- The **admin** (path B and changes) sees the same list with each helper's hours, the fewest first, and can pick anyone on it.

Add to the query above:

```sql
SELECT u.user_id, u.name,
       COALESCE(SUM(w.effort_hrs), 0) AS week_hours
FROM users u
LEFT JOIN bookings w
       ON w.helper_id = u.user_id
      AND w.booking_id <> :b
      AND w.approval_status IN ('awaiting_payment', 'pending_approval',
                                'quoted', 'accepted', 'confirmed')
      AND w.date_time >= :week_start         -- Monday 00:00 IST of the booking's week
      AND w.date_time <  :week_start + INTERVAL '7 days'
WHERE u.role = 'employee'
  AND NOT EXISTS ( /* overlap check, as above */ )
GROUP BY u.user_id, u.name
ORDER BY week_hours ASC, u.user_id ASC;
```

### Dates the customer can pick

The date & time step only offers slots where **at least one helper is available**. The step comes after Details, so the backend already knows the service, the route and the hours.

1. The browser asks the backend for slots, sending the service, the route and the service hours.
2. For each start time, the backend works out the **effort** (drives from and back to base, the route, the service hours; traffic-aware for that hour) and the **break** (8 h if the effort is more than 9 h).
3. For each of the site's fixed start times (`TIME_SLOTS`: 08:00, 09:00, 10:30, 12:00, 13:30, 14:30, 16:00, 17:30, 19:00) on each day from the first allowed one, 48 h ahead (D17), it builds the window `job_starts_at → ends_at (+ break)` and runs the availability query above with `LIMIT 1`.
4. It returns the slots with at least one free helper. Days with none are greyed out in the calendar; times with none aren't shown.

The check is repeated:

- **On submit:** someone else may have booked the last free helper meanwhile. If nobody is free, submit is refused and the customer picks another time.
- **On payment (path A) or approval (path B):** the actual assignment, as above.

Showing a slot doesn't hold a helper. Only an assignment does (after payment in path A, on approval in path B).

Without a single helper on the books, the calendar would show no dates at all, so the backend needs at least one helper before the site takes bookings.

### The 48-hour payment window

The customer has **48 hours** to accept the quote and pay: from the admin's approval in path B, or from submitting in path A. This is `bookings.pay_by`.

| When the customer pays | What the backend does |
|---|---|
| **Less than 48 h before the start** (after `confirm_by`) | Don't take the payment. Set `expired` and tell the customer: *"It's too late to confirm this booking. Please send a new request."* |
| **Within 48 h, path B** | The helper the admin picked is still held. Take the payment. |
| **Within 48 h, path A** | Check for an available helper, as for any path A payment. |
| **After 48 h** (both paths) | Check again for an available helper (fewest hours first) **before** taking any money. |
| ↳ a helper is free | Assign them (`helper_source = auto`). It may be a different helper from the one the admin picked. Take the payment; the booking is `confirmed`. |
| ↳ no helper is free | Don't take the payment. Set the booking to `expired` and tell the customer: *"No helper is free for this time any more. Please send a new request."* with a link to book again. |

In path A the check also runs before taking money within the 48 hours: if nobody is free, the customer gets the same "send a new request" message.

Two deadlines, so two scheduled jobs:

- **`pay_by`** (48 h after the quote): sets `helper_id = NULL` on unpaid path B bookings, so the held helper is free for others. The booking stays open.
- **`confirm_by`** (48 h before the start): sets every unpaid booking to `expired` and releases any helper.

If the quote is issued less than 48 hours before `confirm_by`, the customer's time to pay is shorter: the earlier deadline wins. An admin can't approve a request after its `confirm_by`.

The price stays the same after the 48 hours.

### When a job runs over

Helpers can't decline a job, but a job can take longer than planned (e.g. a long wait at the hospital).

1. The backend learns the job is running over in one of two ways:
   - the helper sets it to **running over** in the app and enters when they now expect to be back at base; or
   - a **check every 10 minutes** finds an `in_progress` job past its planned `ends_at` that isn't completed. It's marked running over, with the expected end set 30 minutes ahead until the helper updates it.
2. The backend sets `job_status = running_over` and `expected_end_at`, and pushes `ends_at` and `blocked_until` later to match. If the effort now passes 9 hours, the 8-hour break is added after it.
3. It **alerts the admin** (below).
4. The helper **calls the admin** to explain. This happens outside the app.
5. For each next appointment at risk, the admin either:
   - **assigns a new helper**: from the available list for that appointment (fewest hours first), as in *Changing a helper* below; or
   - **cancels the appointment**: `cancelled`, `cancelled_by` = the admin, with a reason the customer sees. The helper is released.
6. When the helper finishes, they set the job to **completed**, and the customer gets an extra bill (below).

Until the admin acts, the overlapping appointments stay with the same helper, and the alert stays open.

### Alerts to the admin

Every time a running-over job's expected end changes (the helper's update or the 10-minute check), the backend re-works out three things and alerts the admin about each one that's new:

| Alert | When | Message to the admin |
|---|---|---|
| `running_over` | The job is past its planned end, or the helper reported it | "*Helper* is running over on *booking*. Now expected back at base at *time*." |
| `break_due` | The job's effort will now be more than 9 hours, so the helper needs an 8-hour break after it. Sent as soon as that's known, and again 1 hour before the 9-hour mark if it's still running | "*Helper* will pass 9 hours on *booking*. They need an 8-hour break until *time*." |
| `next_at_risk` | The helper's next appointment starts (`job_starts_at`) before the new `blocked_until` (the late end, plus the break if due) | "*Helper* won't be free for *next booking* at *time*. **Change the helper** or **cancel the appointment**." |

Alerts are shown **in the admin view** (`/admin`), not by email or text:

- **On every admin page:** a notification bell in the admin header with the number of open alerts. It opens a list of them, newest first, with `next_at_risk` alerts marked urgent and pinned to the top.
- **Live:** an open admin page checks for new alerts every 30 seconds and shows a banner when one arrives, so the admin doesn't have to reload.
- **Admin dashboard:** the **Alerts** section at the top lists every open alert with its actions.
- **History:** resolved alerts stay listed under the booking, with who resolved them and how.

`next_at_risk` alerts link to the next appointment with two buttons:

- **Change helper:** shows the helpers available for that appointment (fewest hours first). Picking one resolves the alert (`resolution = new_helper`).
- **Cancel appointment:** cancels it with a reason the customer sees (`resolution = cancelled`).

The backend resolves alerts itself (`resolution = job_finished`) when the helper completes the job in time for the next appointment. An admin can also dismiss one (e.g. the next customer agreed to a later start by phone).

### Extra bill for overruns

The customer pays for the extra time when their job runs over.

1. **Rate shown up front.** Extra time is charged at the **same rate as the service's normal hourly rate**: ₹500/hr for a hospital visit, ₹100/hr for a driver (no per-km charge, even in our vehicle). It's copied to the booking's `overrun_rate` when it's quoted; an admin enters one only for a service with no hourly rate. The review page and the quote email show it: *"If the job takes longer than planned, extra time is charged at ₹500 per hour."*
2. **Counted at the end.** When the helper marks the job completed, the backend works out the extra time: `completed_at` − `planned_ends_at`, rounded up to the next half hour (the same rounding as D28).
3. **Billed.** `overrun_amount` = extra hours × `overrun_rate`, in the booking's currency. The booking gets `overrun_status = due`.
4. **Customer pays.** They get an email with a **Pay** link, and the booking shows **Extra bill due** on their dashboard. Payment goes through the same provider as the booking (D21). When it succeeds, `overrun_status = paid`.
5. **Admin can waive it**, e.g. when the delay was our fault: `overrun_status = waived`.

Example: a hospital visit planned to be back at base at 15:00 finishes at 16:20. Extra time 1 h 20 min → 1.5 h × ₹500 = **₹750**.

### Picking or changing a helper (admin)

The same steps cover approving a path B request and changing a helper later.

1. Admin opens the booking and asks for available helpers. The backend runs the query above.
2. Admin picks one. The backend **runs the check again** for that helper inside the same transaction (someone else may have just been given that slot), then sets `helper_id`, `helper_source = admin` and `dashboard.helper_accept = no`. When approving, the quote is saved in the same transaction.
3. When changing, the old helper is released by the same update; their window is free again.

---

## 8. Rules

1. The backend picks `approval_mode` on submit from `services.auto_priced`, the pricing rules (D28) and the effort: `auto` only when the effort, from leaving base to getting back, is **9 hours or less**. The customer can't choose it.
2. Helpers are assigned only to paid path A bookings (automatically, when the payment succeeds) and to path B requests an admin approves (by the admin, as part of approving). Submitting never assigns anyone.
3. The customer can only pick, and submit, a date and time when at least one helper is available for it. The backend checks this on submit too, not only in the date picker.
4. A helper is never assigned to a booking whose window overlaps one of their other open bookings, task or break ([7](#7-helper-assignment-and-availability)). The check runs on every assignment, automatic or by an admin.
5. A booking is confirmed (paid) no later than 48 hours before its start (`confirm_by`). Payment is refused after that.
6. A payment is taken only when the booking is `awaiting_payment` or `accepted` **and** it has a helper: the one still held (path B, within 48 h) or one found by the availability check just before payment. Without a free helper, no money is taken and the customer is asked to send a new request. A payment that lands after the booking was declined, expired or cancelled is kept with `payment_status = late` for an admin (D24).
7. A job that finishes after `planned_ends_at` gets an extra bill: extra time rounded up to 0.5 h × the booking's `overrun_rate`. The rate is shown to the customer before they pay for the booking. Only an admin can waive the extra bill.
8. When a job runs over, the backend alerts the admin in the admin view once per new problem: running over, break coming up (effort past 9 h), and each next appointment the helper can no longer reach in time. An alert stays open until an admin changes the helper, cancels the appointment, dismisses it, or the job finishes in time.
9. Helpers can't decline. Only an admin changes or removes a helper, or cancels an appointment when the helper's previous job runs over.
10. Every status change goes through one guarded function that updates `bookings` and `dashboard` together.
11. **Cancellation** is one transaction:
   1. Check the caller owns the booking (`bookings.user_id`) or is an admin cancelling because the helper's previous job ran over, and the status is open (`pending_approval`, `quoted`, `accepted`, `awaiting_payment` or `confirmed`). Anything else is refused.
   2. Set `approval_status = cancelled`, `cancelled_at` and `cancellation_reason`.
   3. Set `helper_id = NULL` to release the helper.
   4. Set `dashboard.section = cancelled` and `helper_accept = no`.

---

## 9. Open questions

1. **Two payments for the last free helper at once.** The check runs before taking money, but two customers on the payment page together could both pass it. Should the helper be held for a few minutes (e.g. 30) while the customer is on the payment page?
2. **Time left for path B.** Submitting needs only 48 hours' notice (D17), and paying must happen 48 hours before the start, so a request submitted just over 48 hours ahead leaves almost no time for an admin to quote and the customer to pay. Should path B requests need more notice (e.g. 72 hours), or should the date picker warn about it?
3. **Same price after 48 hours?** This model keeps the quoted price. For auto-priced trips, traffic-based drive times may have changed.
4. **Accept and pay as two steps.** Today they're one action (D13). If they stay one action, drop `accepted`.
5. **Cancellation conflicts with D16** (no cancellation in v1). D16 and the lifecycle in `CLAUDE.md` need updating.
6. **Refunds** for cancelled paid bookings (by the customer, or by an admin when the helper's previous job ran over), and any cancellation cut-off before the start.
7. **History.** Putting the helper on `bookings` keeps only the current one, and there's no status history table. `CLAUDE.md` requires an audit trail of status changes, so a small `booking_history` table may still be needed.
8. **Readable IDs.** `01_02`-style IDs leak how many users and bookings exist and can be guessed. The app uses random IDs internally plus a separate display reference; the sketch's IDs could be that display reference.
9. **An extra bill that isn't paid.** Is there a deadline? Should the customer be blocked from new bookings until it's paid?
10. **A grace period.** Should a few minutes late (e.g. under 15) be free?
11. Should the helper be emailed when they're released from a booking?
12. **Checking every 10 minutes needs a paid Vercel plan.** The Hobby plan only runs scheduled jobs once a day (`vercel.ts`). Options: move to Pro, or run the check from an outside scheduler. Until then, alerts only come from the helper's own updates.
13. **Alerts only reach an admin who has the admin view open.** If nobody is signed in when a job runs over, the alert waits there until someone opens it. Is an admin always expected to be watching during service hours?

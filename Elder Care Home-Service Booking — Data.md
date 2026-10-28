# Elder Care Home-Service Booking — Data Model

| | |
|---|---|
| **Version** | 1.0 (draft) |
| **Date** | 2026-10-27 |
| **Database** | PostgreSQL |
| **ORM / Backend** | Prisma + NestJS |
| **Status** | Draft for review |

---

## Table of Contents
1. [Overview](#1-overview)
2. [Assumptions](#2-assumptions)
3. [Conventions](#3-conventions)
4. [Table Summary](#4-table-summary)
5. [Entity Relationship Diagram](#5-entity-relationship-diagram)
6. [Enums](#6-enums)
7. [Table Definitions](#7-table-definitions)
   - 7.1 [Identity & Access](#71-identity--access)
   - 7.2 [Care Recipients](#72-care-recipients)
   - 7.3 [Service Catalog](#73-service-catalog)
   - 7.4 [Employee Capability](#74-employee-capability)
   - 7.5 [Booking Workflow](#75-booking-workflow)
   - 7.6 [Payments & Payouts](#76-payments--payouts)
   - 7.7 [Supporting Tables](#77-supporting-tables)
8. [Status Lifecycles](#8-status-lifecycles)
9. [Business Rules & Invariants](#9-business-rules--invariants)
10. [Role-Based Data Access](#10-role-based-data-access)
11. [Sensitive Data Handling](#11-sensitive-data-handling)
12. [Prisma Implementation Notes](#12-prisma-implementation-notes)
13. [Open Questions](#13-open-questions)

---

## 1. Overview

A platform where families book home services (personal care, nursing, housekeeping, companionship, etc.) for elderly people. The **admin acts as facilitator** between customers and service workers.

### Roles

| Role | Who | Main actions |
|---|---|---|
| **ADMIN** | Platform operator / facilitator | Reviews requests, assigns employees, creates quotes, records payments, pays employees |
| **CUSTOMER** | The elderly person or a family member booking on their behalf | Creates requests, accepts/rejects quotes, pays, reviews |
| **EMPLOYEE** | Service worker / caregiver | Accepts/declines assignments, checks in/out of visits, records work notes |

### End-to-end flow

```
 CUSTOMER                    ADMIN                         EMPLOYEE
    │                          │                               │
    │── 1. Submit request ────►│                               │
    │                          │── 2. Assign + offer payout ──►│
    │                          │◄───────── 3. Accept/decline ──│
    │◄──────── 4. Send quote ──│                               │
    │── 5. Accept / reject ───►│                               │
    │                          │── 6. Schedule visit(s) ──────►│
    │                          │                               │── 7. Check in / out
    │── 8. Pay ───────────────►│                               │
    │                          │── 9. Pay employee (payout) ──►│
    │── 10. Review (optional) ►│                               │
```

---

## 2. Assumptions

These assumptions shape the model. See [Open Questions](#13-open-questions) for items still to confirm.

1. The **customer pays the platform**; the **platform pays the employee**. The difference is the platform fee.
2. A customer may book for **themselves or for an elderly relative**, so the person receiving care (`care_recipients`) is separate from the account holder.
3. One customer can manage **multiple care recipients** (e.g. both parents).
4. One service request = **one service type at one address**. A request can have **multiple visits**.
5. The employee can **accept or decline** an assignment. The admin offers a payout amount when assigning.
6. The quote is sent **only after the employee accepts** the assignment, so the customer is never quoted for an unavailable worker.
7. Payment timing is flexible: the model supports **pay on acceptance** or **pay after completion**.
8. Payments can be **online** (payment gateway) or **recorded offline** by the admin (cash, bank transfer).
9. An admin can create a request **on behalf of a customer** (e.g. an elderly person phones in).
10. Recurring bookings ("every Mon/Wed/Fri at 9am") are **Phase 2**.

---

## 3. Conventions

| Topic | Convention |
|---|---|
| **Table names** | `snake_case`, plural (`service_requests`). Prisma models are `PascalCase` singular, mapped with `@@map`. |
| **Primary keys** | `id UUID DEFAULT gen_random_uuid()` |
| **Timestamps** | `created_at`, `updated_at` as `TIMESTAMPTZ NOT NULL DEFAULT now()`. Always stored in **UTC**. |
| **Soft delete** | `deleted_at TIMESTAMPTZ NULL` on tables marked *soft delete*. Financial records are **never** deleted. |
| **Money** | `INTEGER` in **minor units** (cents / paise) + `currency CHAR(3)` (ISO 4217). Never `FLOAT`. `INTEGER` supports up to ~21.4 million major units per value, enough for a single booking; use `BIGINT` for reporting aggregates. |
| **Phone numbers** | E.164 format, e.g. `+447700900123` |
| **Emails** | Stored lowercased |
| **Enums** | PostgreSQL enums (Prisma `enum`) |
| **Foreign keys** | `ON DELETE RESTRICT` by default. `CASCADE` only where stated. |
| 🔒 | **Sensitive data** (health, home access, financial). Encrypt at column level, restrict access, audit reads. |
| 🛡 | **Admin-only** field. Never returned by customer or employee APIs. |

---

## 4. Table Summary

| # | Table | Domain | Phase | Purpose |
|---|---|---|---|---|
| 1 | `users` | Identity | MVP | Login account for every role |
| 2 | `user_sessions` | Identity | MVP | Refresh tokens / active sessions |
| 3 | `customer_profiles` | Identity | MVP | Customer-specific details |
| 4 | `employee_profiles` | Identity | MVP | Employee details, verification, payout account |
| 5 | `care_recipients` | Care | MVP | The elderly person receiving care |
| 6 | `addresses` | Care | MVP | Where services are delivered |
| 7 | `emergency_contacts` | Care | MVP | Who to call in an emergency |
| 8 | `service_categories` | Catalog | MVP | Groups of services |
| 9 | `services` | Catalog | MVP | Services customers can request |
| 10 | `employee_skills` | Capability | MVP | Which employee can do which service |
| 11 | `employee_availability` | Capability | Phase 2 | Weekly working hours |
| 12 | `employee_time_off` | Capability | Phase 2 | Leave / unavailable periods |
| 13 | `documents` | Capability | Phase 2 | ID proofs, certificates, background checks |
| 14 | `service_requests` | Booking | MVP | The booking request (core table) |
| 15 | `assignments` | Booking | MVP | Admin assigns an employee to a request |
| 16 | `quotes` | Booking | MVP | Versioned price offer to the customer |
| 17 | `quote_line_items` | Booking | MVP | Price breakdown of a quote |
| 18 | `visits` | Booking | MVP | Each actual visit, with check-in/out |
| 19 | `payments` | Money | MVP | Customer → platform |
| 20 | `payouts` | Money | MVP | Platform → employee |
| 21 | `payout_items` | Money | MVP | Which jobs a payout covers |
| 22 | `notifications` | Supporting | MVP | Email / SMS / push / in-app messages |
| 23 | `status_history` | Supporting | MVP | Every status change, who and when |
| 24 | `audit_logs` | Supporting | MVP | Access to sensitive data and key actions |
| 25 | `reviews` | Supporting | Phase 2 | Customer rating of the employee |
| 26 | `recurring_schedules` | Booking | Phase 2 | Repeating bookings |

> `quote_line_items`, `payout_items`, `service_categories` and `employee_skills` are in MVP because they are cheap to add now and painful to retrofit once data exists.

---

## 5. Entity Relationship Diagram

```
users ─┬─ 1:1 ─ customer_profiles ─┬─ 1:* ─ care_recipients ─┬─ 1:* ─ addresses
       │                           │                         └─ 1:* ─ emergency_contacts
       │                           └─ 1:* ─ service_requests
       │
       ├─ 1:1 ─ employee_profiles ─┬─ 1:* ─ employee_skills ─ *:1 ─ services ─ *:1 ─ service_categories
       │                           ├─ 1:* ─ employee_availability
       │                           ├─ 1:* ─ employee_time_off
       │                           └─ 1:* ─ payouts ─ 1:* ─ payout_items
       │
       ├─ 1:* ─ user_sessions
       ├─ 1:* ─ notifications
       └─ 1:* ─ documents


service_requests ─┬─ *:1 ─ customer_profiles, care_recipients, addresses, services
                  ├─ 1:* ─ assignments ─ *:1 ─ employee_profiles
                  ├─ 1:* ─ quotes ─ 1:* ─ quote_line_items
                  ├─ 1:* ─ visits ─ *:1 ─ employee_profiles
                  ├─ 1:* ─ payments ─ *:1 ─ quotes
                  ├─ 1:* ─ payout_items
                  ├─ 1:0..1 ─ reviews
                  └─ *:0..1 ─ recurring_schedules          (Phase 2)


status_history, audit_logs ── polymorphic (entity_type + entity_id) → any table
```

---

## 6. Enums

| Enum | Values | Used in |
|---|---|---|
| `user_role` | `ADMIN`, `CUSTOMER`, `EMPLOYEE` | users |
| `user_status` | `ACTIVE`, `SUSPENDED`, `DEACTIVATED` | users |
| `gender` | `FEMALE`, `MALE`, `OTHER`, `PREFER_NOT_TO_SAY` | employee_profiles, care_recipients |
| `relationship_type` | `SELF`, `PARENT`, `GRANDPARENT`, `SPOUSE`, `SIBLING`, `RELATIVE`, `OTHER` | care_recipients |
| `contact_method` | `PHONE`, `SMS`, `EMAIL` | customer_profiles |
| `mobility_level` | `INDEPENDENT`, `NEEDS_SUPPORT`, `WHEELCHAIR`, `BEDBOUND` | care_recipients |
| `verification_status` | `PENDING`, `VERIFIED`, `REJECTED`, `EXPIRED` | employee_profiles, documents |
| `document_type` | `ID_PROOF`, `ADDRESS_PROOF`, `BACKGROUND_CHECK`, `CERTIFICATION`, `OTHER` | documents |
| `pricing_type` | `HOURLY`, `PER_VISIT`, `FIXED` | services |
| `time_slot` | `MORNING` (08–12), `AFTERNOON` (12–16), `EVENING` (16–20), `ANY` | service_requests |
| `request_urgency` | `NORMAL`, `URGENT` | service_requests |
| `request_status` | `SUBMITTED`, `ASSIGNED`, `QUOTED`, `ACCEPTED`, `REJECTED`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`, `CANCELLED` | service_requests |
| `assignment_status` | `ASSIGNED`, `ACCEPTED`, `DECLINED`, `CANCELLED` | assignments |
| `quote_status` | `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED`, `CANCELLED` | quotes |
| `visit_status` | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `MISSED`, `CANCELLED` | visits |
| `payment_method` | `CARD`, `BANK_TRANSFER`, `WALLET`, `CASH`, `OTHER` | payments |
| `payment_status` | `PENDING`, `PAID`, `FAILED`, `PARTIALLY_REFUNDED`, `REFUNDED` | payments |
| `payout_method` | `BANK_TRANSFER`, `CASH`, `OTHER` | payouts |
| `payout_status` | `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED` | payouts |
| `notification_channel` | `EMAIL`, `SMS`, `PUSH`, `IN_APP` | notifications |
| `notification_status` | `QUEUED`, `SENT`, `FAILED` | notifications |
| `recurrence_frequency` | `DAILY`, `WEEKLY`, `BIWEEKLY` | recurring_schedules |
| `schedule_status` | `ACTIVE`, `PAUSED`, `ENDED` | recurring_schedules |

---

## 7. Table Definitions

### 7.1 Identity & Access

#### `users`
One login account per person, for every role. *Soft delete.*

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| role | user_role | No | | ADMIN, CUSTOMER or EMPLOYEE |
| full_name | VARCHAR(150) | No | | Display name |
| email | VARCHAR(255) | Yes | UNIQUE | Stored lowercased |
| phone | VARCHAR(20) | Yes | UNIQUE | E.164. Many elderly users prefer phone + OTP login |
| password_hash | VARCHAR(255) | Yes | | Argon2/bcrypt hash. NULL for OTP-only or SSO users |
| status | user_status | No | DEFAULT `ACTIVE` | |
| profile_photo_url | VARCHAR(500) | Yes | | |
| email_verified_at | TIMESTAMPTZ | Yes | | |
| phone_verified_at | TIMESTAMPTZ | Yes | | |
| last_login_at | TIMESTAMPTZ | Yes | | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | Yes | | Soft delete |

**Constraints:** `CHECK (email IS NOT NULL OR phone IS NOT NULL)`
**Indexes:** `(role, status)`

---

#### `user_sessions`
Active refresh tokens, so sessions can be listed and revoked.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| user_id | UUID | No | FK → users.id, ON DELETE CASCADE | |
| refresh_token_hash | VARCHAR(255) | No | UNIQUE | Hash only; never store the raw token |
| user_agent | VARCHAR(500) | Yes | | Device / browser |
| ip_address | INET | Yes | | |
| expires_at | TIMESTAMPTZ | No | | |
| revoked_at | TIMESTAMPTZ | Yes | | Set on logout or forced sign-out |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(user_id)`, `(expires_at)`

---

#### `customer_profiles`
Customer-specific details. One row per CUSTOMER user.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| user_id | UUID | No | FK → users.id, UNIQUE | |
| preferred_contact_method | contact_method | No | DEFAULT `PHONE` | |
| preferred_language | VARCHAR(10) | No | DEFAULT `'en'` | BCP 47 code |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

---

#### `employee_profiles`
Service worker details, verification and payout account. One row per EMPLOYEE user. *Soft delete.*

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| user_id | UUID | No | FK → users.id, UNIQUE | |
| employee_code | VARCHAR(20) | No | UNIQUE | Human-friendly ID, e.g. `EMP-0001` |
| gender | gender | Yes | | Some care recipients prefer a same-gender caregiver |
| date_of_birth | DATE | Yes | | 🔒 |
| bio | TEXT | Yes | | Shown to customers |
| years_of_experience | SMALLINT | No | DEFAULT 0, CHECK ≥ 0 | |
| languages | TEXT[] | No | DEFAULT `'{}'` | Languages spoken, e.g. `{en,hi}` |
| base_postal_code | VARCHAR(20) | Yes | | Home area, for matching |
| service_radius_km | SMALLINT | No | DEFAULT 10 | How far they will travel |
| timezone | VARCHAR(50) | No | | IANA zone, e.g. `Europe/London` |
| verification_status | verification_status | No | DEFAULT `PENDING` | Must be `VERIFIED` to receive assignments |
| verified_at | TIMESTAMPTZ | Yes | | |
| verified_by | UUID | Yes | FK → users.id (admin) | |
| background_check_date | DATE | Yes | | |
| background_check_expires_on | DATE | Yes | | Re-check before expiry |
| default_hourly_rate | INTEGER | Yes | CHECK ≥ 0 | 🛡 Standard pay per hour (minor units) |
| currency | CHAR(3) | No | | |
| payout_account_ref | VARCHAR(100) | Yes | | 🔒 Payment-provider token or encrypted bank details |
| payout_account_last4 | VARCHAR(4) | Yes | | For display only |
| is_active | BOOLEAN | No | DEFAULT true | Admin can deactivate |
| average_rating | DECIMAL(3,2) | Yes | | Denormalized from `reviews` |
| total_jobs_completed | INTEGER | No | DEFAULT 0 | Denormalized counter |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | Yes | | Soft delete |

**Indexes:** `(verification_status, is_active)`, `(base_postal_code)`

> There is no `admin_profiles` table. Admins only need the fields in `users`. Add one later if admins need extra attributes (e.g. region).

---

### 7.2 Care Recipients

#### `care_recipients`
The elderly person who receives the service. May be the customer themselves (`relationship_to_customer = SELF`). *Soft delete.*

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| customer_id | UUID | No | FK → customer_profiles.id | Account that manages this person |
| full_name | VARCHAR(150) | No | | |
| date_of_birth | DATE | Yes | | |
| gender | gender | Yes | | |
| relationship_to_customer | relationship_type | No | | SELF, PARENT, etc. |
| phone | VARCHAR(20) | Yes | | Recipient's own phone, if any |
| preferred_language | VARCHAR(10) | Yes | | |
| preferred_caregiver_gender | gender | Yes | | Matching preference |
| mobility_level | mobility_level | Yes | | |
| medical_conditions | TEXT | Yes | | 🔒 e.g. diabetes, dementia |
| medications | TEXT | Yes | | 🔒 |
| allergies | TEXT | Yes | | 🔒 |
| care_notes | TEXT | Yes | | 🔒 Hearing, diet, behaviour, routines |
| primary_doctor_name | VARCHAR(150) | Yes | | |
| primary_doctor_phone | VARCHAR(20) | Yes | | |
| health_data_consent_at | TIMESTAMPTZ | Yes | | When consent to store health data was given. Required before any 🔒 health field is saved |
| health_data_consent_by | UUID | Yes | FK → users.id | Who gave consent |
| is_active | BOOLEAN | No | DEFAULT true | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | Yes | | Soft delete |

**Indexes:** `(customer_id)`

---

#### `addresses`
Where services are delivered. A care recipient can have several (e.g. own home, daughter's home). *Soft delete.*

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| care_recipient_id | UUID | No | FK → care_recipients.id | |
| label | VARCHAR(50) | No | DEFAULT `'Home'` | |
| line1 | VARCHAR(255) | No | | |
| line2 | VARCHAR(255) | Yes | | |
| city | VARCHAR(100) | No | | |
| state | VARCHAR(100) | Yes | | |
| postal_code | VARCHAR(20) | No | | |
| country | CHAR(2) | No | | ISO 3166-1 alpha-2 |
| latitude | DECIMAL(9,6) | Yes | | For matching and check-in validation |
| longitude | DECIMAL(9,6) | Yes | | |
| access_instructions | TEXT | Yes | | 🔒 Gate code, key safe, which door |
| is_primary | BOOLEAN | No | DEFAULT false | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | Yes | | Soft delete |

**Indexes:** `(care_recipient_id)`, `(postal_code)`
**Partial unique:** one primary address per recipient: `UNIQUE (care_recipient_id) WHERE is_primary AND deleted_at IS NULL`

---

#### `emergency_contacts`
Who to call if something happens during a visit.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| care_recipient_id | UUID | No | FK → care_recipients.id, ON DELETE CASCADE | |
| full_name | VARCHAR(150) | No | | |
| relationship | VARCHAR(50) | No | | e.g. Son, Neighbour |
| phone | VARCHAR(20) | No | | |
| alternate_phone | VARCHAR(20) | Yes | | |
| email | VARCHAR(255) | Yes | | |
| priority | SMALLINT | No | DEFAULT 1, CHECK ≥ 1 | 1 = call first |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Unique:** `(care_recipient_id, priority)`

---

### 7.3 Service Catalog

#### `service_categories`

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| name | VARCHAR(100) | No | UNIQUE | e.g. Personal Care, Nursing, Housekeeping, Companionship, Physiotherapy |
| description | TEXT | Yes | | |
| sort_order | SMALLINT | No | DEFAULT 0 | Display order |
| is_active | BOOLEAN | No | DEFAULT true | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

---

#### `services`
What customers can request. Prices here are **guides** for the admin. The quote is the binding price.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| category_id | UUID | No | FK → service_categories.id | |
| name | VARCHAR(150) | No | | e.g. Bathing assistance, Post-surgery nursing |
| description | TEXT | Yes | | |
| pricing_type | pricing_type | No | | HOURLY, PER_VISIT or FIXED |
| base_price | INTEGER | No | CHECK ≥ 0 | Guide price to the customer, per unit |
| default_employee_rate | INTEGER | No | CHECK ≥ 0 | 🛡 Guide payout to the employee, per unit |
| currency | CHAR(3) | No | | |
| typical_duration_minutes | INTEGER | Yes | CHECK > 0 | |
| min_duration_minutes | INTEGER | Yes | CHECK > 0 | Minimum booking length |
| requires_certification | BOOLEAN | No | DEFAULT false | If true, only certified employees can be assigned |
| is_active | BOOLEAN | No | DEFAULT true | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Unique:** `(category_id, name)`

---

### 7.4 Employee Capability

#### `employee_skills`
Which services each employee is allowed to perform.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| employee_id | UUID | No | FK → employee_profiles.id, ON DELETE CASCADE | |
| service_id | UUID | No | FK → services.id | |
| is_certified | BOOLEAN | No | DEFAULT false | Verified by admin |
| certification_document_id | UUID | Yes | FK → documents.id | Phase 2 column (added with `documents`) |
| years_experience | SMALLINT | Yes | CHECK ≥ 0 | |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Unique:** `(employee_id, service_id)`
**Indexes:** `(service_id)` to find employees for a service

---

#### `employee_availability` *(Phase 2)*
Regular weekly working hours, in the employee's `timezone`.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| employee_id | UUID | No | FK → employee_profiles.id, ON DELETE CASCADE | |
| day_of_week | SMALLINT | No | CHECK 0–6 | 0 = Sunday |
| start_time | TIME | No | | Local time |
| end_time | TIME | No | CHECK end_time > start_time | Local time |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(employee_id, day_of_week)`

---

#### `employee_time_off` *(Phase 2)*

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| employee_id | UUID | No | FK → employee_profiles.id, ON DELETE CASCADE | |
| start_at | TIMESTAMPTZ | No | | |
| end_at | TIMESTAMPTZ | No | CHECK end_at > start_at | |
| reason | VARCHAR(255) | Yes | | |
| approved_by | UUID | Yes | FK → users.id (admin) | |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(employee_id, start_at)`

---

#### `documents` *(Phase 2)*
Uploaded files: ID proofs, certificates, background checks. Files live in private object storage, not in the database. *Soft delete.*

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| owner_user_id | UUID | No | FK → users.id | |
| type | document_type | No | | |
| file_name | VARCHAR(255) | No | | Original file name |
| storage_key | VARCHAR(500) | No | UNIQUE | 🔒 Object-storage key. Serve via short-lived signed URL only |
| mime_type | VARCHAR(100) | No | | |
| size_bytes | INTEGER | No | CHECK > 0 | |
| expires_on | DATE | Yes | | e.g. certificate expiry |
| verification_status | verification_status | No | DEFAULT `PENDING` | |
| verified_by | UUID | Yes | FK → users.id (admin) | |
| verified_at | TIMESTAMPTZ | Yes | | |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | Yes | | Soft delete |

**Indexes:** `(owner_user_id, type)`, `(expires_on)`

---

### 7.5 Booking Workflow

#### `service_requests`
The core table. One row per booking request.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| request_number | VARCHAR(20) | No | UNIQUE | Human-friendly, e.g. `SR-2026-000123` |
| customer_id | UUID | No | FK → customer_profiles.id | |
| care_recipient_id | UUID | No | FK → care_recipients.id | Must belong to `customer_id` |
| service_id | UUID | No | FK → services.id | |
| address_id | UUID | No | FK → addresses.id | Must belong to `care_recipient_id` |
| recurring_schedule_id | UUID | Yes | FK → recurring_schedules.id | Phase 2 column. Set if generated from a schedule |
| preferred_date | DATE | No | | |
| preferred_time_slot | time_slot | No | DEFAULT `ANY` | |
| preferred_start_time | TIME | Yes | | If the customer has an exact time |
| estimated_duration_minutes | INTEGER | Yes | CHECK > 0 | |
| urgency | request_urgency | No | DEFAULT `NORMAL` | |
| customer_notes | TEXT | Yes | | What the customer needs |
| admin_notes | TEXT | Yes | | 🛡 Internal notes |
| status | request_status | No | DEFAULT `SUBMITTED` | See [8.1](#81-service_requests) |
| created_by | UUID | No | FK → users.id | Customer, or admin booking on their behalf |
| submitted_at | TIMESTAMPTZ | No | DEFAULT now() | |
| completed_at | TIMESTAMPTZ | Yes | | |
| closed_at | TIMESTAMPTZ | Yes | | |
| cancelled_at | TIMESTAMPTZ | Yes | | |
| cancelled_by | UUID | Yes | FK → users.id | |
| cancellation_reason | TEXT | Yes | | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(status, preferred_date)`, `(customer_id, created_at)`, `(care_recipient_id)`

> The current employee and accepted quote are **not** stored here. They are derived from `assignments` and `quotes`, where partial unique indexes guarantee there is only one active row of each.

---

#### `assignments`
The admin assigns an employee to a request and offers a payout amount. The employee accepts or declines. Reassignments create new rows, so the history is kept.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| request_id | UUID | No | FK → service_requests.id | |
| employee_id | UUID | No | FK → employee_profiles.id | |
| assigned_by | UUID | No | FK → users.id (admin) | |
| offered_payout_amount | INTEGER | No | CHECK ≥ 0 | What the employee will be paid for this job (minor units). Visible to the employee |
| currency | CHAR(3) | No | | |
| status | assignment_status | No | DEFAULT `ASSIGNED` | See [8.3](#83-assignments) |
| assigned_at | TIMESTAMPTZ | No | DEFAULT now() | |
| respond_by | TIMESTAMPTZ | Yes | | Deadline for the employee to respond |
| responded_at | TIMESTAMPTZ | Yes | | |
| decline_reason | TEXT | Yes | | |
| admin_notes | TEXT | Yes | | 🛡 |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(employee_id, status)`, `(request_id)`
**Partial unique:** one active assignment per request: `UNIQUE (request_id) WHERE status IN ('ASSIGNED','ACCEPTED')`

---

#### `quotes`
Price offer from the admin to the customer. **Versioned and immutable once sent.** A revision is a new row with `version + 1`.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| request_id | UUID | No | FK → service_requests.id | |
| version | SMALLINT | No | CHECK ≥ 1 | 1, 2, 3… |
| status | quote_status | No | DEFAULT `DRAFT` | See [8.2](#82-quotes) |
| currency | CHAR(3) | No | | |
| subtotal_amount | INTEGER | No | CHECK ≥ 0 | Sum of line items |
| discount_amount | INTEGER | No | DEFAULT 0, CHECK ≥ 0 | |
| tax_amount | INTEGER | No | DEFAULT 0, CHECK ≥ 0 | |
| total_amount | INTEGER | No | CHECK ≥ 0 | What the customer pays |
| employee_payout_amount | INTEGER | No | CHECK ≥ 0 | 🛡 What the employee will be paid. Copied from the accepted assignment's `offered_payout_amount` |
| platform_fee_amount | INTEGER | No | CHECK ≥ 0 | 🛡 Platform margin |
| valid_until | TIMESTAMPTZ | No | | Customer must respond before this |
| message_to_customer | TEXT | Yes | | |
| internal_notes | TEXT | Yes | | 🛡 |
| created_by | UUID | No | FK → users.id (admin) | |
| sent_at | TIMESTAMPTZ | Yes | | |
| responded_at | TIMESTAMPTZ | Yes | | |
| responded_by | UUID | Yes | FK → users.id | Customer who accepted/rejected |
| rejection_reason | TEXT | Yes | | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Unique:** `(request_id, version)`
**Partial unique:** at most one live quote per request: `UNIQUE (request_id) WHERE status IN ('SENT','ACCEPTED')`
**Check constraints:**
- `total_amount = subtotal_amount - discount_amount + tax_amount`
- `platform_fee_amount = total_amount - tax_amount - employee_payout_amount`
- `discount_amount <= subtotal_amount`

---

#### `quote_line_items`
Breakdown shown to the customer, e.g. "3 hours × personal care", "medical supplies".

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| quote_id | UUID | No | FK → quotes.id, ON DELETE CASCADE | |
| service_id | UUID | Yes | FK → services.id | NULL for extras (materials, travel) |
| description | VARCHAR(255) | No | | |
| quantity | DECIMAL(10,2) | No | CHECK > 0 | Hours can be fractional |
| unit | VARCHAR(20) | No | | `hour`, `visit`, `item` |
| unit_price | INTEGER | No | CHECK ≥ 0 | Minor units |
| amount | INTEGER | No | CHECK ≥ 0 | `ROUND(quantity × unit_price)` |
| sort_order | SMALLINT | No | DEFAULT 0 | |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(quote_id)`

---

#### `visits`
Each actual visit to the care recipient's home. One request can have several visits (e.g. a 5-day post-hospital care package).

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| request_id | UUID | No | FK → service_requests.id | |
| employee_id | UUID | No | FK → employee_profiles.id | Who actually attends. Can differ from the original assignment after reassignment |
| visit_number | SMALLINT | No | CHECK ≥ 1 | 1, 2, 3… within the request |
| scheduled_start | TIMESTAMPTZ | No | | |
| scheduled_end | TIMESTAMPTZ | No | CHECK scheduled_end > scheduled_start | |
| status | visit_status | No | DEFAULT `SCHEDULED` | See [8.4](#84-visits) |
| check_in_at | TIMESTAMPTZ | Yes | | |
| check_in_latitude | DECIMAL(9,6) | Yes | | Optional location proof |
| check_in_longitude | DECIMAL(9,6) | Yes | | |
| check_out_at | TIMESTAMPTZ | Yes | CHECK check_out_at > check_in_at | |
| check_out_latitude | DECIMAL(9,6) | Yes | | |
| check_out_longitude | DECIMAL(9,6) | Yes | | |
| actual_duration_minutes | INTEGER | Yes | | Calculated at check-out |
| work_summary | TEXT | Yes | | What was done. Visible to the customer |
| care_observations | TEXT | Yes | | 🔒 Mood, appetite, health changes noticed |
| incident_reported | BOOLEAN | No | DEFAULT false | Fall, injury, medical emergency |
| incident_notes | TEXT | Yes | | 🔒 |
| customer_confirmed_at | TIMESTAMPTZ | Yes | | Customer/family confirms the visit happened |
| cancellation_reason | TEXT | Yes | | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Unique:** `(request_id, visit_number)`
**Indexes:** `(employee_id, scheduled_start)`, `(status, scheduled_start)` for missed-visit alerts

---

### 7.6 Payments & Payouts

#### `payments`
Money from the customer to the platform. Each attempt is a separate row, so failed attempts are kept.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| request_id | UUID | No | FK → service_requests.id | |
| quote_id | UUID | No | FK → quotes.id | The accepted quote being paid |
| amount | INTEGER | No | CHECK > 0 | Minor units |
| currency | CHAR(3) | No | | Must match the quote |
| method | payment_method | No | | |
| status | payment_status | No | DEFAULT `PENDING` | See [8.5](#85-payments) |
| gateway | VARCHAR(50) | Yes | | Payment provider name. NULL for offline payments |
| gateway_payment_id | VARCHAR(100) | Yes | UNIQUE | Provider's transaction ID |
| gateway_response | JSONB | Yes | | Raw webhook payload, for debugging. Must not contain card data |
| recorded_by | UUID | Yes | FK → users.id (admin) | Set for offline payments (cash, bank transfer) |
| paid_at | TIMESTAMPTZ | Yes | | |
| failure_reason | TEXT | Yes | | |
| refunded_amount | INTEGER | No | DEFAULT 0, CHECK 0 ≤ refunded_amount ≤ amount | |
| refunded_at | TIMESTAMPTZ | Yes | | |
| refund_reason | TEXT | Yes | | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(request_id)`, `(status, created_at)`

> A request is **paid in full** when `SUM(amount - refunded_amount)` over its `PAID` / `PARTIALLY_REFUNDED` payments is ≥ the accepted quote's `total_amount`.

---

#### `payouts`
Money from the platform to an employee. One payout can cover one job or a batch of jobs (e.g. weekly).

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| payout_number | VARCHAR(20) | No | UNIQUE | e.g. `PO-2026-000045` |
| employee_id | UUID | No | FK → employee_profiles.id | |
| amount | INTEGER | No | CHECK > 0 | Must equal the sum of its `payout_items` |
| currency | CHAR(3) | No | | |
| method | payout_method | No | | |
| status | payout_status | No | DEFAULT `PENDING` | See [8.6](#86-payouts) |
| period_start | DATE | Yes | | For batch payouts |
| period_end | DATE | Yes | | |
| reference | VARCHAR(100) | Yes | | Bank transfer reference |
| created_by | UUID | No | FK → users.id (admin) | |
| paid_by | UUID | Yes | FK → users.id (admin) | |
| paid_at | TIMESTAMPTZ | Yes | | |
| failure_reason | TEXT | Yes | | |
| notes | TEXT | Yes | | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(employee_id, status)`, `(status, created_at)`

---

#### `payout_items`
Links a payout to the jobs it pays for.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| payout_id | UUID | No | FK → payouts.id, ON DELETE CASCADE | |
| request_id | UUID | No | FK → service_requests.id, UNIQUE | A job is paid out **once** |
| amount | INTEGER | No | CHECK > 0 | Normally the accepted quote's `employee_payout_amount` |
| adjustment_reason | TEXT | Yes | | Required if `amount` differs from the quote (e.g. visit ran longer) |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

> If a payout fails, **retry the same payout record** (`FAILED → PROCESSING`) rather than creating a new one. This keeps the `UNIQUE (request_id)` guarantee against paying twice.

---

### 7.7 Supporting Tables

#### `notifications`
Every message sent to a user, on any channel.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| user_id | UUID | No | FK → users.id, ON DELETE CASCADE | Recipient |
| type | VARCHAR(50) | No | | See list below |
| channel | notification_channel | No | | |
| title | VARCHAR(200) | No | | |
| body | TEXT | No | | Must not contain 🔒 data (SMS and email are not secure) |
| entity_type | VARCHAR(30) | Yes | | e.g. `SERVICE_REQUEST`, for deep links |
| entity_id | UUID | Yes | | |
| status | notification_status | No | DEFAULT `QUEUED` | |
| sent_at | TIMESTAMPTZ | Yes | | |
| read_at | TIMESTAMPTZ | Yes | | In-app only |
| failure_reason | TEXT | Yes | | |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(user_id, read_at)`, `(status, created_at)`

**Notification types**

| Type | Sent to |
|---|---|
| `REQUEST_SUBMITTED` | Admins |
| `ASSIGNMENT_CREATED` | Employee |
| `ASSIGNMENT_ACCEPTED` / `ASSIGNMENT_DECLINED` | Admins |
| `QUOTE_SENT` | Customer |
| `QUOTE_ACCEPTED` / `QUOTE_REJECTED` | Admins |
| `QUOTE_EXPIRING` | Customer |
| `VISIT_SCHEDULED` | Customer, employee |
| `VISIT_REMINDER` | Customer, employee |
| `EMPLOYEE_CHECKED_IN` / `EMPLOYEE_CHECKED_OUT` | Customer |
| `VISIT_MISSED` | Admins, customer |
| `INCIDENT_REPORTED` | Admins, customer |
| `PAYMENT_RECEIVED` / `PAYMENT_FAILED` | Customer, admins |
| `PAYOUT_PAID` | Employee |

---

#### `status_history`
Append-only log of every status change on any workflow table. Written **in the same database transaction** as the change.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| entity_type | VARCHAR(30) | No | | `SERVICE_REQUEST`, `ASSIGNMENT`, `QUOTE`, `VISIT`, `PAYMENT`, `PAYOUT` |
| entity_id | UUID | No | | |
| from_status | VARCHAR(30) | Yes | | NULL on creation |
| to_status | VARCHAR(30) | No | | |
| changed_by | UUID | Yes | FK → users.id | NULL = system job (e.g. quote expiry) |
| comment | TEXT | Yes | | e.g. rejection reason |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(entity_type, entity_id, created_at)`

---

#### `audit_logs`
Append-only log of access to sensitive data and important actions. Needed because the system stores health information.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| actor_user_id | UUID | Yes | FK → users.id | NULL = system |
| action | VARCHAR(50) | No | | e.g. `VIEW_MEDICAL_INFO`, `VIEW_ACCESS_INSTRUCTIONS`, `EXPORT_DATA`, `UPDATE_PAYOUT_ACCOUNT`, `LOGIN_FAILED` |
| entity_type | VARCHAR(30) | Yes | | |
| entity_id | UUID | Yes | | |
| ip_address | INET | Yes | | |
| user_agent | VARCHAR(500) | Yes | | |
| metadata | JSONB | Yes | | Extra context. Never the sensitive values themselves |
| created_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(entity_type, entity_id)`, `(actor_user_id, created_at)`

---

#### `reviews` *(Phase 2)*

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| request_id | UUID | No | FK → service_requests.id, UNIQUE | One review per request |
| customer_id | UUID | No | FK → customer_profiles.id | |
| employee_id | UUID | No | FK → employee_profiles.id | |
| rating | SMALLINT | No | CHECK 1–5 | |
| comment | TEXT | Yes | | |
| is_published | BOOLEAN | No | DEFAULT true | Admin can hide abusive reviews |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(employee_id, created_at)`

---

#### `recurring_schedules` *(Phase 2)*
Repeating bookings. A daily background job creates `service_requests` (or `visits`) from active schedules a few days ahead.

| Column | Type | Nullable | Default / Constraints | Description |
|---|---|---|---|---|
| id | UUID | No | PK | |
| customer_id | UUID | No | FK → customer_profiles.id | |
| care_recipient_id | UUID | No | FK → care_recipients.id | |
| service_id | UUID | No | FK → services.id | |
| address_id | UUID | No | FK → addresses.id | |
| preferred_employee_id | UUID | Yes | FK → employee_profiles.id | Continuity of care: same caregiver each time |
| frequency | recurrence_frequency | No | | |
| days_of_week | SMALLINT[] | Yes | | For WEEKLY / BIWEEKLY, e.g. `{1,3,5}` = Mon, Wed, Fri |
| start_time | TIME | No | | Local time |
| duration_minutes | INTEGER | No | CHECK > 0 | |
| timezone | VARCHAR(50) | No | | IANA zone |
| start_date | DATE | No | | |
| end_date | DATE | Yes | CHECK end_date ≥ start_date | NULL = open-ended |
| status | schedule_status | No | DEFAULT `ACTIVE` | |
| notes | TEXT | Yes | | |
| created_by | UUID | No | FK → users.id | |
| created_at, updated_at | TIMESTAMPTZ | No | DEFAULT now() | |

**Indexes:** `(status, start_date)`, `(care_recipient_id)`

---

## 8. Status Lifecycles

### 8.1 `service_requests`

```
SUBMITTED ──► ASSIGNED ──► QUOTED ──► ACCEPTED ──► SCHEDULED ──► IN_PROGRESS ──► COMPLETED ──► CLOSED
    ▲             │           │  ▲
    └─(declined)──┘           ▼  │
                          REJECTED ─(revised quote)

CANCELLED: allowed from any status before IN_PROGRESS
```

| From | To | Actor | Trigger / side effects |
|---|---|---|---|
| — | SUBMITTED | Customer or Admin | Request created. Notify admins |
| SUBMITTED | ASSIGNED | Admin | Assignment created (`ASSIGNED`). Notify employee |
| ASSIGNED | SUBMITTED | Employee / System | Employee declines, or `respond_by` passes. Assignment → `DECLINED`. Admin must reassign |
| ASSIGNED | QUOTED | Admin | Allowed only when the assignment is `ACCEPTED`. Quote → `SENT`. Notify customer |
| QUOTED | ACCEPTED | Customer | Quote → `ACCEPTED` (before `valid_until`). Notify admins |
| QUOTED | REJECTED | Customer | Quote → `REJECTED` with reason. Notify admins |
| REJECTED | QUOTED | Admin | New quote version → `SENT` |
| ACCEPTED | SCHEDULED | Admin | Visit(s) created. Notify customer and employee |
| SCHEDULED | IN_PROGRESS | Employee | First visit check-in |
| IN_PROGRESS | COMPLETED | Employee / System | All visits are `COMPLETED`, `MISSED` or `CANCELLED`, at least one `COMPLETED` |
| COMPLETED | CLOSED | System | Paid in full **and** payout `PAID` |
| SUBMITTED … SCHEDULED | CANCELLED | Customer or Admin | Active assignment → `CANCELLED`. Live quote → `CANCELLED`. Scheduled visits → `CANCELLED`. Refund if already paid |

> If a quote expires (`QUOTED` with quote `EXPIRED`), the request stays `QUOTED` until the admin sends a new version or cancels.
> If the employee becomes unavailable after `QUOTED` or later, the admin creates a new assignment. If the payout changes, a new quote version is needed.

### 8.2 `quotes`

| From | To | Actor | Trigger |
|---|---|---|---|
| — | DRAFT | Admin | Created. Editable. Drafts may be deleted |
| DRAFT | SENT | Admin | Sent to customer. **Immutable from now on** |
| SENT | ACCEPTED | Customer | Before `valid_until` |
| SENT | REJECTED | Customer | With optional reason |
| SENT | EXPIRED | System | `valid_until` passed |
| SENT | SUPERSEDED | Admin | A newer version was sent |
| SENT / ACCEPTED | CANCELLED | Admin / System | Request cancelled |

### 8.3 `assignments`

| From | To | Actor | Trigger |
|---|---|---|---|
| — | ASSIGNED | Admin | Employee assigned with an offered payout |
| ASSIGNED | ACCEPTED | Employee | |
| ASSIGNED | DECLINED | Employee / System | Declined, or no response by `respond_by` |
| ASSIGNED / ACCEPTED | CANCELLED | Admin | Reassignment, or request cancelled |

### 8.4 `visits`

| From | To | Actor | Trigger |
|---|---|---|---|
| — | SCHEDULED | Admin / System | Created after quote acceptance |
| SCHEDULED | IN_PROGRESS | Employee | Check-in |
| IN_PROGRESS | COMPLETED | Employee | Check-out with `work_summary` |
| SCHEDULED | MISSED | System | No check-in 30 minutes after `scheduled_start`. **Alert admins immediately**, as this is a safety risk for an elderly person |
| SCHEDULED | CANCELLED | Customer / Admin | |

### 8.5 `payments`

| From | To | Actor | Trigger |
|---|---|---|---|
| — | PENDING | Customer / Admin | Payment started, or offline payment being recorded |
| PENDING | PAID | Gateway webhook / Admin | Confirmed |
| PENDING | FAILED | Gateway webhook | A retry creates a new payment row |
| PAID | PARTIALLY_REFUNDED / REFUNDED | Admin | Refund issued |
| PARTIALLY_REFUNDED | REFUNDED | Admin | Remaining amount refunded |

### 8.6 `payouts`

| From | To | Actor | Trigger |
|---|---|---|---|
| — | PENDING | Admin | Payout created with items |
| PENDING | PROCESSING | Admin / System | Transfer started |
| PROCESSING | PAID | Admin / System | Transfer confirmed. Write `reference` |
| PROCESSING | FAILED | System | Transfer failed |
| FAILED | PROCESSING | Admin | Retry the same record |
| PENDING | CANCELLED | Admin | Before any money moves |

---

## 9. Business Rules & Invariants

| # | Rule | Enforced by |
|---|---|---|
| 1 | A request's `care_recipient_id` must belong to its `customer_id`, and `address_id` must belong to that care recipient | Application (service layer) |
| 2 | Only **one active assignment** per request | Partial unique index |
| 3 | An assigned employee must be `VERIFIED`, `is_active`, have an `employee_skills` row for the service, and be `is_certified` if the service `requires_certification` | Application |
| 4 | A quote can be sent only when the request's active assignment is `ACCEPTED` | Application |
| 5 | At most **one live quote** (`SENT` or `ACCEPTED`) per request. Sending a new version marks the current `SENT` one `SUPERSEDED` | Partial unique index + application |
| 6 | A quote is **immutable once `SENT`**. Changes require a new version | Application |
| 7 | Quote totals must add up (see `quotes` check constraints) | DB check constraints |
| 8 | `quotes.employee_payout_amount` = the accepted assignment's `offered_payout_amount` | Application |
| 9 | A customer can accept a quote only before `valid_until` | Application |
| 10 | An employee can check in only to **their own** visits, no more than 60 minutes before `scheduled_start`, and optionally within a set distance of the address | Application |
| 11 | Payouts only for `COMPLETED` requests. Each request is paid out **once** | Application + `UNIQUE (payout_items.request_id)` |
| 12 | `payouts.amount` = `SUM(payout_items.amount)` | Application (same transaction) |
| 13 | A request becomes `CLOSED` only when it is paid in full **and** its payout is `PAID` | Application / background job |
| 14 | Every status change writes a `status_history` row **in the same transaction** | Application |
| 15 | Health fields (🔒 in `care_recipients`) can be saved only if `health_data_consent_at` is set | Application |
| 16 | Financial records (`quotes`, `payments`, `payouts`, `payout_items`) are **never deleted** | No delete endpoints. Restrict DB permissions |
| 17 | Reviews only for `COMPLETED` / `CLOSED` requests, one per request, by the request's customer | Application + unique index |

---

## 10. Role-Based Data Access

| Data | Admin | Customer | Employee |
|---|---|---|---|
| `users` | All | Own account | Own account |
| `care_recipients`: name, age, language, mobility | All | Own | Only for their active or upcoming assignments |
| `care_recipients`: 🔒 medical fields | All (audited) | Own | Only for their active or upcoming assignments (audited) |
| `addresses`: street address | All | Own | Only for their active or upcoming assignments |
| `addresses.access_instructions` 🔒 | All (audited) | Own | Only on the day of a scheduled visit, until check-out (audited) |
| `emergency_contacts` | All | Own | During their visits |
| `service_requests` | All | Own | Assigned to them. **Excluding** `admin_notes` |
| `assignments` | All | Employee name only | Own, including `offered_payout_amount` |
| `quotes`: totals and line items | All | Own requests. **Excluding** 🛡 fields | No access |
| `quotes`: 🛡 `employee_payout_amount`, `platform_fee_amount` | All | No access | No access (they see `assignments.offered_payout_amount`) |
| `visits` | All | Own requests. **Excluding** 🔒 `care_observations` and `incident_notes` unless the admin shares them | Own visits |
| `payments` | All | Own | No access |
| `payouts`, `payout_items` | All | No access | Own |
| `reviews` | All, can hide | Write own, read published | Read reviews about themselves |
| `status_history` | All | Timeline of own requests | Timeline of their assignments |
| `audit_logs` | All | No access | No access |

---

## 11. Sensitive Data Handling

1. **Column-level encryption** for every 🔒 column, using application-level encryption (e.g. AES-256-GCM with a key held in a key-management service). Encrypted columns cannot be searched or sorted, which is acceptable for these fields.
2. **No card data in the database.** Use a payment gateway's hosted checkout. Store only the gateway's IDs.
3. **No plain-text bank account numbers.** Prefer the payout provider's token; otherwise encrypt and keep `last4` for display.
4. **Record consent** before storing health information (`care_recipients.health_data_consent_at`).
5. **Audit every read** of 🔒 fields in `audit_logs`.
6. **Private file storage.** Documents are served only through short-lived signed URLs.
7. **No sensitive data in notifications.** SMS and email bodies must not contain medical details or access codes.
8. **Data retention.** Define how long to keep data after a care recipient or employee leaves, and anonymise or delete it after that period. Check which data-protection laws apply where you operate (for example GDPR, India's DPDP Act, or HIPAA in the US).
9. **Least-privilege database users.** The application user cannot `DELETE` from financial tables; reporting uses a read-only user.

---

## 12. Prisma Implementation Notes

| PostgreSQL | Prisma |
|---|---|
| `UUID` PK | `String @id @default(uuid()) @db.Uuid` |
| `TIMESTAMPTZ` | `DateTime @db.Timestamptz(6)` |
| `created_at` / `updated_at` | `@default(now())` / `@updatedAt` |
| `INTEGER` money | `Int` |
| `DECIMAL(9,6)` | `Decimal @db.Decimal(9, 6)` |
| `TEXT[]`, `SMALLINT[]` | `String[]`, `Int[] @db.SmallInt` |
| `JSONB` | `Json` |
| `INET` | `String @db.Inet` |
| `TIME` | `DateTime @db.Time(6)` |
| `snake_case` names | `@map("column_name")` on fields, `@@map("table_name")` on models |

**Not expressible in `schema.prisma`.** Add these in a hand-written SQL migration (`prisma migrate dev --create-only`, then edit the SQL):
- **Partial unique indexes**: `assignments` (one active), `quotes` (one live), `addresses` (one primary)
- **CHECK constraints**: quote totals, rating 1–5, time ranges, non-negative amounts
- **`CHECK (email IS NOT NULL OR phone IS NOT NULL)`** on `users`

**Circular / multiple relations.** `users` is referenced many times from the same table (e.g. `quotes.created_by` and `quotes.responded_by`), so each relation needs a name: `@relation("QuoteCreatedBy")`.

**Human-friendly numbers** (`request_number`, `payout_number`): generate them from a PostgreSQL sequence, e.g. `'SR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('service_request_seq')::text, 6, '0')`.

---

## 13. Open Questions

| # | Question | Impact on model |
|---|---|---|
| 1 | Does the customer pay **on quote acceptance** or **after the service**? | Changes when `payments` rows are created, and whether `SCHEDULED` requires payment |
| 2 | **Online gateway** in v1, or offline payments recorded by the admin only? Which gateway? | `payments.gateway*` columns; webhook handling |
| 3 | Should the employee **see and accept the payout** before the quote is sent? (Assumed yes) | `assignments.offered_payout_amount`; rule 4 |
| 4 | For multi-visit jobs, is the payout **per job** or **per visit**? | `payout_items` uniqueness: `request_id` vs `visit_id` |
| 5 | Are **recurring bookings** needed in v1? | Moves `recurring_schedules` into MVP |
| 6 | **Cancellation and refund policy**, e.g. a fee for late cancellation? | Add `cancellation_fee_amount` to `service_requests`; refund rules |
| 7 | Is **tax** charged on services? At what rates? | `quotes.tax_amount` calculation; possibly a `tax_rates` table |
| 8 | **Single city / time zone**, or multiple? | Whether `timezone` columns are needed or can default |
| 9 | Can the customer **choose or request a specific employee**? | Add `preferred_employee_id` to `service_requests` |
| 10 | Should family members other than the account holder get **their own logins** to follow a recipient's care? | Add a `care_recipient_members` join table (user ↔ recipient with permissions) |

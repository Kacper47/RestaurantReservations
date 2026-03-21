# Restaurant Reservations

A Spring Boot web application for managing restaurant reservations, table availability, and guest reviews.

## Features

- Guest flow:
  - Add a reservation
  - Edit or cancel a reservation using phone + reservation code
  - Add and browse reviews
- Administrator flow:
  - Sign in with `code + name` (from `staff` table)
  - Open the admin dashboard
  - View daily table plan
  - Filter reservations by table
  - Delete reservations directly from the database
- Reservation rules:
  - Maximum `10` guests per online reservation
  - Time must be selected in `15-minute` intervals
  - A table is blocked for `2 hours` after each reservation
  - Available tables are returned by backend rules (not only frontend filtering)

## Tech Stack

- Java 17+
- Spring Boot
- Spring Web
- Spring Data JPA
- Static frontend (HTML/CSS/JavaScript)

## Project Structure

- `src/main/java/.../controller`
  - `ReservationController` - guest-facing API and reservation business rules
  - `AdminController` - admin login and dashboard API
- `src/main/java/.../repository`
  - JPA repositories for reservations, tables, customers, reviews, and staff
- `src/main/resources/static`
  - `index.html` - entry page (Guest / Administrator)
  - `guest.html` - guest home with action cards
  - `add.html`, `edit.html`, `reviews.html`, `admin.html`
  - `core.js` - shared frontend utilities
  - `public-pages.js` - guest and public page logic
  - `admin-page.js` - admin dashboard logic
  - `app.js` - minimal bootstrap

## Running Locally

From the `restaurant-reservations` directory:

```powershell
.\mvnw.cmd spring-boot:run
```

Then open:

```text
http://localhost:8080
```

## API Overview

- `GET /api/tables`
- `GET /api/tables/available?date=YYYY-MM-DD&time=HH:mm&guests=N`
- `POST /api/reservations`
- `PUT /api/reservations/edit`
- `DELETE /api/reservations/by-code`
- `GET /api/reservations/lookup?phone=...&code=...`
- `POST /api/reviews`
- `GET /api/reviews`
- `GET /api/staff/login?code=...&name=...`
- `GET /api/admin/dashboard?date=YYYY-MM-DD`
- `DELETE /api/admin/reservations/{id}`

## Notes

- Business constraints are enforced on the backend to keep behavior consistent regardless of frontend input.
- Frontend validation is kept for UX, but backend remains the source of truth.

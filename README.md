# Restaurant Reservations Workspace

This repository is split into two clearly separated parts:

- `app-frontend-backend` - Spring Boot application (REST API + static frontend).
- `db-server` - local database server setup (Docker Compose for MySQL).

## Folder Layout

```text
RestaurantReservationsRepo/
+-- app-frontend-backend/                 # application code (backend + frontend)
|   +-- src/main/java                     # Spring Boot backend
|   +-- src/main/resources/static         # HTML/CSS/JS frontend
|   +-- pom.xml
|   +-- mvnw
|   +-- mvnw.cmd
+-- db-server/                            # server infra for local DB
|   +-- docker-compose.yml
|   +-- mys/
+-- README.md
```

## What Is In `app-frontend-backend`

Main capabilities:

- Guest flow:
  - add reservation
  - edit/cancel reservation by phone + reservation code
  - add and browse reviews
- Administrator flow:
  - login by `code + name` from `staff` table
  - open daily table plan
  - filter reservations by table
  - delete reservations directly from admin panel
- Reservation rules enforced by backend:
  - max 10 guests online
  - time in 15-minute intervals
  - 2-hour table blocking window

## Database Server (Docker)

The MySQL container config is in:

- `db-server/docker-compose.yml`

Default setup:

- DB name: `resto`
- App user: `app`
- App password: `apppass`
- Root password: `rootpass`
- Port: `3306`

Start DB server:

```powershell
cd db-server
docker compose up -d
```

Stop DB server:

```powershell
docker compose down
```

## Run Application

From application folder:

```powershell
cd app-frontend-backend
.\mvnw.cmd spring-boot:run
```

App runs on (current config):

```text
http://localhost:8081
```

## Typical Local Startup Order

1. Start DB:

```powershell
cd db-server
docker compose up -d
```

2. Start app:

```powershell
cd ..\app-frontend-backend
.\mvnw.cmd spring-boot:run
```

3. Open:

```text
http://localhost:8081
```

## Notes

- Frontend validation is for UX only.
- Backend is the source of truth for business rules and reservation constraints.
- If port `3306` is busy, change host mapping in `db-server/docker-compose.yml`.

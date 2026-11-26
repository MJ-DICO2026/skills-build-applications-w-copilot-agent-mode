# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Implement the React routes one capability at a time using the shared API client. Each route will provide loading, success, empty, and accessible error states.
- Logic tier decision: Implement the missing Express/TypeScript service behavior before changing route handling, and return deliberate 4xx responses for invalid input or missing resources instead of allowing database errors to become 500 responses.
- Data tier decision: Complete the Mongoose schemas with the required fields, defaults, and valid ObjectId references while preserving the existing idempotent seed behavior.
- Activity tracking approach: Validate userId and teamId before creating an activity, ensure both referenced records exist, store type and minutes, and calculate points and occurredAt.
- Team management approach: Validate required team fields, reject missing names with a 400 response, preserve name and mascot, and initialize members safely.
- Leaderboard approach: Aggregate activity points by team, order teams from highest to lowest total points, and return teamName, totalPoints, and a 1-based rank.
- Workout suggestions approach: Find the seeded user by email and recommend workouts based on the user's fitness goal or recent activity patterns. Return a deliberate 4xx response when the user does not exist.

## Test plan

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  - Baseline: 4 failed, 1 passed.
  - The failures indicate incomplete required-field validation in the User, Team, Activity, and Workout Mongoose schemas. The idempotent seed contract already passes.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  - Baseline: 4 failed.
  - The failures cover activity/team creation, leaderboard generation, and workout suggestions.
- Frontend command: `npm test --prefix octofit-tracker/frontend`
  - Baseline: 15 failed.
  - The failures indicate that the UI still uses placeholder capability components and does not yet implement the expected loading, API-data, empty, and error states.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
- Verification order: run data-tier tests first, then API tests, then frontend tests, and finally both build commands.
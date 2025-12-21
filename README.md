
# Welcome to REProDashboard

## Project info

**URL**: https://lovable.dev/projects/ffc6d87f-6ac4-4fa3-894a-f0fbdd8c1bfc

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/ffc6d87f-6ac4-4fa3-894a-f0fbdd8c1bfc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Auth & API configuration

The dashboard talks to the Laravel backend for every login and authenticated API call. To avoid breaking authentication when your Vite dev server runs on a random host/port:

1. Make sure the backend is running locally (by default on `http://localhost:8000`).
2. Copy the snippet below into a local `.env` file (same directory as this README) **only if you truly need to override the default**:

```
VITE_API_URL=http://127.0.0.1:8000
# Optional if the backend runs on a non-standard port while keeping the same host:
VITE_API_PORT=8000
```

If `VITE_API_URL` is omitted, the UI automatically points to `http://<current-host>:VITE_API_PORT` whenever you run `npm run dev` on localhost/127.0.0.1/::1 or any private LAN IP. When a private LAN host is set in `VITE_API_URL` but differs from the machine serving the frontend, the app now logs a warning and falls back to the current origin to avoid the dreaded `ERR_CONNECTION_REFUSED` loop. This prevents the browser from sending login requests to an unreachable IP or back to the Vite dev server by mistake.

### Verifying login end-to-end

- Run `php artisan migrate --seed` inside `repro-backend` to create the seeded admin users.
- Start the backend with `php artisan serve --host=127.0.0.1 --port=8000`.
- Start the frontend with `npm run dev` (or `npm run build && npm run preview` for production).
- Try logging in with `superadmin@example.com / Password123!`. If you see an error, run the automated regression tests below.

### Automated regression tests

```
cd repro-backend
php artisan test --filter=LoginTest
```

The feature test exercises `/api/login` with a seeded user, ensuring future changes cannot silently break authentication.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/ffc6d87f-6ac4-4fa3-894a-f0fbdd8c1bfc) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)

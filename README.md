# Lead Intelligence Frontend

The Next.js dashboard uses TanStack Query to load the company pipeline and
call the FastAPI company and discovery endpoints.

## Getting Started

Set the API base URL in `.env.local` in the `frontend` directory:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Start the FastAPI service from the `Agent` directory using the backend setup
instructions, then start the frontend:

```powershell
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API allows this local
frontend origin by default; configure `FRONTEND_ORIGINS` in the backend
environment when using a different origin.

The dashboard supports complete company records, status changes, company
editing and deletion, manual creation, web discovery, and saving discovery
results to the backend pipeline. Saving discovery results also requests
mobile and desktop PageSpeed Insights scans across four Lighthouse categories.
The Lead pipeline shows scan history and loads detailed audit reports on
demand.

## Useful commands

```powershell
npm run lint
npm run build
```

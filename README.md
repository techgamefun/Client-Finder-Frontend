# ProspectLoop Frontend

The Next.js dashboard uses TanStack Query to manage website research, contacts,
and outreach through the FastAPI API.

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

The **Websites** registry is the source of truth for discovered sites, business
profile details, workflow status, indexing and PageSpeed data, contacts, and
outreach activity. Website profiles support editing business details and
managing saved contacts. Crawled public email addresses and telephone numbers
are imported as contacts, while raw crawl extractions remain visible on the
website profile.

Discovery results can be explicitly saved to the website registry. Saving
queues website crawls and background PageSpeed scans. Website status and group
management, search, filters, and pagination are handled by the backend.

The **Email templates** page lets organization admins create and manage shared
HTML email templates. Members can render a database-backed preview for a
website and contact, then send it using a Gmail account assigned to them.
Available `website`, `contact`, and `sender` placeholders are listed in the
editor and can be inserted directly into the subject or message body.

The **Gmail** page lets assigned members compose and send email from the
selected account, browse its Inbox and Spam folders, and open user-created
Gmail labels. It also supports searching, reading, and replying to messages.

Campaign audiences are selected from websites and their saved contacts.
Campaign history remains attached to websites and contacts, and website
profiles show the latest successful campaign email without changing workflow
status.

The **Discover websites** page lets you choose configured search providers,
search with a natural-language query, review provider and relevance details,
and explicitly add selected results to the website registry. Saving queues
website crawls, and PageSpeed scans run in the background. Tavily searches
support collapsible advanced filters, and bulk registry saves include every displayed
result. **Auto Find More Results** can continue searching until no new domains
are found, excluding displayed and already-registered domains; each additional
Tavily search uses credits. Search depth, default country, and excluded domains
can be configured by organization admins in **Settings → Tavily**.
Enter up to five keywords separated by commas or new lines to search them in
parallel. The selected result limit is shared across the keywords, results are
deduplicated by website domain, and the searches used are shown with results.
**AI Search** uses a saved Gemini or Groq key to add up to two related queries
when the shared result limit allows, then searches those alongside the entered
keywords through Tavily. Tavily credits apply to each search.

## Useful commands

```powershell
npm run lint
npm run build
```

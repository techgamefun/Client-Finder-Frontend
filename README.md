# ProspectLoop Frontend

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
The Lead pipeline shows scan history and only the four category scores; raw
Lighthouse audit reports are not retained.

Company detail pages include a **Contacts** tab for adding, editing, and
removing company contacts. Contact changes are saved through the
organization-scoped contact API and refresh the company and lead data.
Crawled public email addresses and telephone numbers are imported as separate
contacts, so contact details are managed in one place instead of a duplicate
company email list. Raw crawl extractions remain visible on website profiles.

The **Companies** page is the master database and includes companies with or
without contacts. The **Lead pipeline** is a qualified view that includes only
companies with at least one contact. Adding a contact from a company profile
refreshes the shared company data, so that company then appears in the Lead
pipeline automatically. Both pages apply search, filters, and pagination on
the backend and request only the current page of company records.

The **Email templates** page lets organization admins create and manage shared
HTML email templates. Members can render a database-backed preview for a
company and contact, then send it using a Gmail account assigned to them.
Available `company`, `contact`, and `sender` placeholders are listed in the
editor and can be inserted directly into the subject or message body.

The **Gmail** page lets assigned members compose and send email from the
selected account, browse its Inbox and Spam folders, and open user-created
Gmail labels. It also supports searching, reading, and replying to messages.

On the **Lead pipeline**, admins can select leads individually, by page, or
across the current filtered results and carry that audience into campaign
setup. The pipeline also shows whether each company has received a successful
campaign email and when it was sent; this does not change the company's sales
pipeline status.

The **Discover websites** page lets you choose configured search providers,
search with a natural-language query, review provider and relevance details,
and explicitly add selected results to the website registry. Saving queues
website crawls; it does not create companies. Tavily searches support
collapsible advanced filters, and bulk registry saves include every displayed
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

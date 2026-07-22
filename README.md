# Far-to-Fair

Static site prepared for Cloudflare Pages.

## Cloudflare Pages

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `/`

## Evidence Brain

The cockpit is designed to use a web-search-backed intelligence endpoint in production:

- Endpoint: `/api/research`
- Required environment variable: `SEARCH_API_URL`
- Optional environment variable: `SEARCH_API_KEY`

The endpoint fails closed. If search is not configured, or if the evidence is weak, claims are returned as `not verified` / `exclude_from_model` rather than being used in impact calculations.

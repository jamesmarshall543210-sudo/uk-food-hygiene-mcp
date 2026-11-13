# UK Food Hygiene Ratings — MCP server

An MCP server (TypeScript, Streamable HTTP, plus optional stdio) for official UK Food Standards Agency hygiene ratings (FHRS in England, Wales and Northern Ireland, and FHIS in Scotland). It uses the free public FSA API (`api.ratings.food.gov.uk`) and needs no FSA API key.

You can run this repository locally, or use the hosted server on [MCPize](https://mcpize.com/mcp/uk-food-hygiene-ratings).

This project is a companion to the Apify Actor [UK Food Hygiene Rating Monitor (FSA)](https://apify.com/inhabitable_jingle_clk/fsa-hygiene-monitor), which is better for scheduled snapshots and detecting removed businesses. Nothing in this repository is a secret, an API token, or a credential.

## Hosted server

- Listing: [uk-food-hygiene-ratings on MCPize](https://mcpize.com/mcp/uk-food-hygiene-ratings)
- MCP endpoint (Streamable HTTP): `https://uk-food-hygiene-ratings.mcpize.run/mcp`

Hosted prices (live, unchanged): **$0.02 per tool call**, or **$9 per month**. Clients must send a MCPize API key:

```json
{
  "mcpServers": {
    "uk-food-hygiene-ratings": {
      "url": "https://uk-food-hygiene-ratings.mcpize.run/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCPIZE_API_KEY"
      }
    }
  }
}
```

Get a key from the [MCPize listing](https://mcpize.com/mcp/uk-food-hygiene-ratings). Do not commit API keys.

## Tools

| Tool | What it does |
| --- | --- |
| `search_establishments` | Search by `name`, `postcode`, `localAuthority` (name or ID), `businessType` (name or ID), with `maxResults` (default 25, max 200). |
| `get_establishment` | Get one business by `fhrsId`. |
| `recent_rating_changes` | Businesses whose rating date falls within the last `days` (default 30), using the same filters. It is stateless and does not store a snapshot. The FSA API cannot sort by date, so it scans at most 500 matches and returns `complete: false` for larger areas. Narrow by postcode or business type for full coverage. It cannot detect removed businesses; the [Apify Actor](https://apify.com/inhabitable_jingle_clk/fsa-hygiene-monitor) snapshot diff does that. |

Each result has these fields: `fhrsId`, `name`, `businessType`, `address`, `postcode`, `rating`, `ratingDate`, `newRatingPending`, `localAuthority`, `scheme`, `sourceUrl`, plus an `attribution` note. Phone numbers, emails and score breakdowns are not included.

## Example calls

```json
{"name": "search_establishments", "arguments": {"postcode": "LS1 4AP"}}
{"name": "get_establishment", "arguments": {"fhrsId": 1781401}}
{"name": "recent_rating_changes", "arguments": {"postcode": "NP12", "days": 30}}
```

## Run locally

```bash
npm install && npm run build
npm start                    # http://localhost:8080/mcp (PORT env var respected)
node dist/index.js --stdio   # stdio for desktop MCP clients
npm test                     # SDK client test against the running HTTP server
```

The local server talks to the public FSA API directly. No API key is required. Optional environment variables are listed in `.env.example` (`PORT`, `NODE_ENV`).

## Other UK open-data tools

- [UK Food Hygiene Rating Monitor (FSA)](https://apify.com/inhabitable_jingle_clk/fsa-hygiene-monitor) — scheduled snapshot monitoring, including removed businesses
- [UK Companies House Compliance Monitor](https://apify.com/inhabitable_jingle_clk/companies-house-compliance-monitor)
- [UK House Price Index by Local Authority](https://apify.com/inhabitable_jingle_clk/uk-house-price-index)
- [UK bank holiday planner](https://n8n.io/workflows/22252) — free n8n template

## Licence and attribution

Example code and documentation in this repository: [MIT](LICENSE), copyright James Marshall 2026.

The ratings themselves are public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Source: Food Standards Agency, https://ratings.food.gov.uk. See [ATTRIBUTION.md](ATTRIBUTION.md). Ratings reflect the standard at the date of inspection.

This project is independent and is not affiliated with or endorsed by the Food Standards Agency, Apify, MCPize or n8n. It uses no FHRS/FHIS logos or official rating images.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ATTRIBUTION, search, getEstablishment } from "./fsa.js";

const ok = (data: object) => ({ content: [{ type: "text" as const, text: JSON.stringify({ ...data, attribution: ATTRIBUTION }, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }] });

const filters = {
  name: z.string().optional().describe("Business name (partial match), e.g. 'Greggs'"),
  postcode: z.string().optional().describe("Full or partial UK postcode, e.g. 'LS1 4AP' or 'NP12'"),
  localAuthority: z.union([z.string(), z.number()]).optional().describe("Local authority name or FSA ID, e.g. 'Caerphilly'"),
  businessType: z.union([z.string(), z.number()]).optional().describe("Business type name or FSA ID, e.g. 'Takeaway/sandwich shop'"),
  maxResults: z.number().int().min(1).max(200).optional().describe("Max results (default 25, max 200)"),
};

export function createServer() {
  const server = new McpServer({ name: "uk-food-hygiene-ratings", version: "0.1.0" });

  server.tool("search_establishments",
    "Search UK food businesses' FSA hygiene ratings (FHRS in England/Wales/NI, FHIS in Scotland) by name, postcode, local authority and/or business type. Returns rating and rating date.",
    filters, async (a) => { try { return ok(await search(a)); } catch (e) { return fail(e); } });

  server.tool("get_establishment", "Get one food business's FSA hygiene rating by its FHRS ID.",
    { fhrsId: z.number().int().describe("FHRS ID from search_establishments") },
    async ({ fhrsId }) => { try { return ok({ result: await getEstablishment(fhrsId) }); } catch (e) { return fail(e); } });

  server.tool("recent_rating_changes",
    "List businesses in an area whose FSA hygiene rating was issued within the last N days (stateless: based on rating date, not a stored snapshot; scans up to 500 matches). Needs at least one filter.",
    { ...filters, days: z.number().int().min(1).max(365).optional().describe("Look-back window in days (default 30)") },
    async ({ days = 30, ...a }) => {
      try {
        const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
        const max = a.maxResults ?? 25;
        // The FSA API cannot sort by rating date, so scan up to 500 matches and filter locally.
        const r = await search({ ...a, maxResults: 500 }, 500);
        const recent = r.results.filter((x) => x.ratingDate && x.ratingDate >= since)
          .sort((x, y) => (y.ratingDate! > x.ratingDate! ? 1 : -1));
        return ok({ since, areaMatches: r.totalMatches, scanned: r.results.length, complete: r.results.length >= r.totalMatches, note: r.results.length < r.totalMatches ? "Area has more than 500 businesses; narrow by postcode or business type for full coverage." : undefined, returned: Math.min(recent.length, max), results: recent.slice(0, max) });
      } catch (e) { return fail(e); }
    });
  return server;
}

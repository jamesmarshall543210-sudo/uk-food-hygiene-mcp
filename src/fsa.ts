// FSA FHRS API helpers (ported from the Apify Actor's lib.js). No API key needed.
export const API = "https://api.ratings.food.gov.uk";
const HEADERS = { "x-api-version": "2", accept: "application/json" };
export const ATTRIBUTION =
  "Contains public sector information licensed under the Open Government Licence v3.0; data from the Food Standards Agency (ratings.food.gov.uk). Not endorsed by the FSA. Always check the rating date.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    let status = 0, err: unknown;
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return await res.json();
      status = res.status; err = new Error(`FSA API ${status}`);
    } catch (e) { err = e; }
    if (!(status === 0 || status === 429 || status >= 500) || attempt >= retries) throw err;
    await sleep(800 * 2 ** attempt);
  }
}

// Business data only: phone/email/score breakdown deliberately dropped.
export function normalise(e: any) {
  const addr = [e.AddressLine1, e.AddressLine2, e.AddressLine3, e.AddressLine4].filter(Boolean).join(", ");
  return {
    fhrsId: e.FHRSID, name: e.BusinessName, businessType: e.BusinessType,
    address: addr || null, postcode: e.PostCode || null,
    rating: e.RatingValue, ratingDate: e.RatingDate ? String(e.RatingDate).slice(0, 10) : null,
    newRatingPending: !!e.NewRatingPending,
    localAuthority: e.LocalAuthorityName, scheme: e.SchemeType,
    sourceUrl: `https://ratings.food.gov.uk/business/${e.FHRSID}`,
  };
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
function resolve(value: string | number | undefined, list: { id: number; name: string }[], label: string) {
  if (value == null || value === "") return undefined;
  if (/^-?\d+$/.test(String(value).trim())) return Number(value);
  const q = norm(String(value));
  const exact = list.filter((x) => norm(x.name) === q);
  if (exact.length === 1) return exact[0].id;
  const partial = list.filter((x) => norm(x.name).includes(q));
  if (partial.length === 1) return partial[0].id;
  throw new Error(partial.length
    ? `${label} "${value}" is ambiguous: ${partial.slice(0, 10).map((x) => x.name).join("; ")}`
    : `${label} "${value}" not found in FSA list.`);
}
let laCache: any[] | undefined, btCache: any[] | undefined;
export async function resolveAuthority(v?: string | number) {
  if (v == null || /^\d+$/.test(String(v))) return v == null ? undefined : Number(v);
  laCache ??= (await fetchJson(`${API}/Authorities/basic`)).authorities.map((a: any) => ({ id: a.LocalAuthorityId, name: a.Name }));
  return resolve(v, laCache!, "Local authority");
}
export async function resolveBusinessType(v?: string | number) {
  if (v == null || /^\d+$/.test(String(v))) return v == null ? undefined : Number(v);
  btCache ??= (await fetchJson(`${API}/BusinessTypes/basic`)).businessTypes
    .filter((b: any) => b.BusinessTypeId !== -1).map((b: any) => ({ id: b.BusinessTypeId, name: b.BusinessTypeName }));
  return resolve(v, btCache!, "Business type");
}

export interface SearchArgs { name?: string; postcode?: string; localAuthority?: string | number; businessType?: string | number; maxResults?: number; }

export async function search(a: SearchArgs, cap = 200) {
  if (!a.name && !a.postcode && a.localAuthority == null && a.businessType == null)
    throw new Error("Give at least one of name, postcode, localAuthority or businessType.");
  const la = await resolveAuthority(a.localAuthority);
  const bt = await resolveBusinessType(a.businessType);
  const max = Math.min(a.maxResults ?? 25, cap);
  const items: ReturnType<typeof normalise>[] = [];
  let total = 0;
  for (let page = 1; items.length < max && page <= 5; page++) {
    const p = new URLSearchParams({ pageNumber: String(page), pageSize: String(Math.min(100, max)) });
    if (a.name) p.set("name", a.name);
    if (a.postcode) p.set("address", a.postcode);
    if (la != null) p.set("localAuthorityId", String(la));
    if (bt != null) p.set("businessTypeId", String(bt));
    const j = await fetchJson(`${API}/Establishments?${p}`);
    total = j.meta?.totalCount ?? total;
    for (const e of j.establishments) items.push(normalise(e));
    if (page >= (j.meta?.totalPages ?? 1)) break;
    await sleep(300);
  }
  return { totalMatches: total, returned: Math.min(items.length, max), results: items.slice(0, max) };
}

export async function getEstablishment(id: number) {
  return normalise(await fetchJson(`${API}/Establishments/${id}`));
}

const HIGH_AUTHORITY_DOMAINS = [
  "gov.in",
  "pib.gov.in",
  "mohfw.gov.in",
  "cdsco.gov.in",
  "nha.gov.in",
  "who.int",
  "ncbi.nlm.nih.gov",
  "accessmedicinefoundation.org"
];

const MEDIUM_AUTHORITY_DOMAINS = [
  "business-standard.com",
  "thehindubusinessline.com",
  "reuters.com",
  "pharmaboardroom.com",
  "thepharmaletter.com",
  "1mg.com",
  "imarcgroup.com"
];

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceTier(url) {
  const host = hostnameOf(url);
  if (!host) return "rejected";
  if (HIGH_AUTHORITY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return "high";
  if (MEDIUM_AUTHORITY_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return "medium";
  if (/blog|forum|reddit|quora|medium\.com|substack/.test(host)) return "low";
  return "unclassified";
}

function normalizeResults(payload) {
  const raw = payload?.results || payload?.items || payload?.organic || [];
  return raw
    .map((item) => ({
      title: item.title || item.name || "Untitled source",
      url: item.url || item.link || "",
      snippet: item.snippet || item.description || item.text || ""
    }))
    .filter((item) => item.url)
    .map((item) => ({
      ...item,
      host: hostnameOf(item.url),
      tier: sourceTier(item.url)
    }));
}

function evidenceSummary(results) {
  const usable = results.filter((r) => r.tier === "high" || r.tier === "medium");
  const high = results.filter((r) => r.tier === "high").length;
  const confidence = high >= 1 && usable.length >= 2 ? "high" : usable.length >= 2 ? "medium" : usable.length === 1 ? "low" : "not verified";
  return {
    confidence,
    usableSources: usable.length,
    highAuthoritySources: high,
    modelUse: confidence === "not verified" ? "exclude_from_model" : confidence === "low" ? "watchlist_only" : "eligible_for_review"
  };
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = String(body.query || "").trim();
  if (!query) {
    return Response.json({ error: "Missing query." }, { status: 400 });
  }

  if (!env.SEARCH_API_URL) {
    return Response.json({
      status: "not_configured",
      query,
      confidence: "not verified",
      modelUse: "exclude_from_model",
      note: "Configure SEARCH_API_URL and optional SEARCH_API_KEY in Cloudflare Pages to enable live web search."
    });
  }

  const upstream = await fetch(env.SEARCH_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.SEARCH_API_KEY ? { authorization: `Bearer ${env.SEARCH_API_KEY}` } : {})
    },
    body: JSON.stringify({ query, limit: Math.min(Number(body.limit || 8), 10) })
  });

  if (!upstream.ok) {
    return Response.json({
      status: "search_failed",
      query,
      confidence: "not verified",
      modelUse: "exclude_from_model",
      upstreamStatus: upstream.status
    }, { status: 502 });
  }

  const payload = await upstream.json();
  const results = normalizeResults(payload);
  return Response.json({
    status: "ok",
    query,
    ...evidenceSummary(results),
    results
  });
}

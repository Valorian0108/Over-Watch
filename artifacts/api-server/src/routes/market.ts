import { Router, type IRouter, type Request, type Response } from "express";
import {
  ExplainMarketQuestionBody,
  GetMarketAssetParams,
  GetMarketAssetsQueryParams,
  GetMarketOverviewQueryParams,
  GetMarketOverviewResponse,
  GetMarketAssetsResponse,
  GetMarketAssetResponse,
  ExplainMarketQuestionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const CMC_SOURCE =
  "CoinMarketCap · /v1/global-metrics/quotes/latest + /v1/cryptocurrency/listings/latest";
const RWA_SOURCE = `${CMC_SOURCE} + /v5/real-world-assets/map`;
const assetColors = [
  "coral",
  "blue",
  "lime",
  "violet",
  "amber",
  "sky",
  "rose",
  "mint",
] as const;

type CmcQuote = {
  USD?: {
    price?: number;
    percent_change_24h?: number;
    market_cap?: number;
    volume_24h?: number;
  };
};

type CmcAsset = {
  id?: number;
  name?: string;
  symbol?: string;
  cmc_rank?: number;
  slug?: string;
  logo?: string;
  quote?: CmcQuote;
};

type CmcMapAsset = {
  id?: number;
  name?: string;
  symbol?: string;
  slug?: string;
  rank?: number;
  cmc_rank?: number;
};

type CmcEnvelope<T> = {
  data?: T;
  status?: { error_message?: string | null };
};

type CmcGlobal = {
  quote?: {
    USD?: {
      total_market_cap?: number;
      total_volume_24h?: number;
      total_market_cap_yesterday_percentage_change?: number;
      total_volume_24h_yesterday_percentage_change?: number;
    };
  };
  btc_dominance?: number;
};

type CmcRwaMap = {
  rwa_assets?: Array<{
    name?: string;
    symbol?: string;
    rwa_id?: number;
    asset_type?: string;
    rwa_rank?: number;
  }>;
};

class ExternalApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalApiError";
  }
}

async function cmcGet<T>(
  path: string,
  query: Record<string, string | number>,
): Promise<T> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    throw new ExternalApiError(
      "CoinMarketCap API key is not configured on the server.",
    );
  }

  const url = new URL(`${CMC_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-CMC_PRO_API_KEY": apiKey,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new ExternalApiError(
      `CoinMarketCap returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const payload = (await response.json()) as CmcEnvelope<T>;
  if (payload.data === undefined) {
    throw new ExternalApiError(
      payload.status?.error_message ?? "CoinMarketCap returned no data.",
    );
  }
  return payload.data;
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function colorFor(symbol: string): (typeof assetColors)[number] {
  const total = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return assetColors[total % assetColors.length];
}

function normalizeAsset(
  item: CmcAsset,
  kind: "crypto" | "rwa",
  index: number,
) {
  const symbol = item.symbol?.toUpperCase() || `ASSET${index + 1}`;
  const quote = item.quote?.USD;
  return {
    id: numberOr(item.id, index + 1),
    name: item.name || symbol,
    symbol,
    kind,
    price: quote?.price ?? null,
    change24h: quote?.percent_change_24h ?? null,
    marketCap: quote?.market_cap ?? null,
    volume24h: quote?.volume_24h ?? null,
    rank: item.cmc_rank ?? null,
    color: colorFor(symbol),
    imageUrl: item.logo ?? null,
  };
}

function normalizeRwaAsset(
  item: NonNullable<CmcRwaMap["rwa_assets"]>[number],
  index: number,
) {
  const symbol = item.symbol?.toUpperCase() || `RWA${index + 1}`;
  return {
    id: numberOr(item.rwa_id, index + 1),
    name: item.name || symbol,
    symbol,
    kind: "rwa" as const,
    price: null,
    change24h: null,
    marketCap: null,
    volume24h: null,
    rank: item.rwa_rank ?? null,
    color: colorFor(symbol),
    imageUrl: null,
  };
}

type NormalizedAsset =
  | ReturnType<typeof normalizeAsset>
  | ReturnType<typeof normalizeRwaAsset>;

type ExplanationAsset = {
  name: string;
  symbol: string;
  kind: "crypto" | "rwa";
  price: number | null;
  change24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  rank: number | null;
};

async function fetchAssets(
  kind: "crypto" | "rwa",
  limit: number,
): Promise<NormalizedAsset[]> {
  if (kind === "crypto") {
    const data = await cmcGet<CmcAsset[]>(
      "/v1/cryptocurrency/listings/latest",
      { start: 1, limit, convert: "USD" },
    );
    return data.map((item, index) => normalizeAsset(item, kind, index));
  }
  const data = await cmcGet<CmcRwaMap>("/v5/real-world-assets/map", {
    listing_status: "active",
    limit,
  });
  return (data.rwa_assets ?? []).map(normalizeRwaAsset);
}

async function searchAssets(
  query: string,
  kind: "crypto" | "rwa" | undefined,
  limit: number,
): Promise<NormalizedAsset[]> {
  const needle = query.trim().toLowerCase();
  const results: NormalizedAsset[] = [];

  if (!kind || kind === "crypto") {
    const map = await cmcGet<CmcMapAsset[]>("/v1/cryptocurrency/map", {
      listing_status: "active",
      limit: 5000,
      sort: "cmc_rank",
    });
    const matches = map
      .filter((item) =>
        [item.name, item.symbol, item.slug].some((value) =>
          value?.toLowerCase().includes(needle),
        ),
      )
      .sort((a, b) => (a.cmc_rank ?? 999999) - (b.cmc_rank ?? 999999))
      .slice(0, limit);

    if (matches.length) {
      const symbols = matches
        .map((item) => item.symbol?.toUpperCase())
        .filter((symbol): symbol is string => Boolean(symbol));
      const quotes = await cmcGet<Record<string, CmcAsset[]>>(
        "/v2/cryptocurrency/quotes/latest",
        { symbol: symbols.join(","), convert: "USD" },
      );
      for (const [index, match] of matches.entries()) {
        const symbol = match.symbol?.toUpperCase() ?? `ASSET${index + 1}`;
        const quoted = quotes[symbol]?.[0];
        results.push(
          normalizeAsset(
            quoted ?? {
              id: match.id,
              name: match.name,
              symbol,
              cmc_rank: match.cmc_rank ?? match.rank,
            },
            "crypto",
            index,
          ),
        );
      }
    }
  }

  if (!kind || kind === "rwa") {
    let matches: NonNullable<CmcRwaMap["rwa_assets"]> = [];
    if (/^[a-z0-9]+$/i.test(query)) {
      const symbolMatch = await cmcGet<CmcRwaMap>("/v5/real-world-assets/map", {
        listing_status: "active",
        limit: 100,
        symbol: query.toUpperCase(),
      });
      matches = symbolMatch.rwa_assets ?? [];
    }
    if (!matches.length) {
      const data = await cmcGet<CmcRwaMap>("/v5/real-world-assets/map", {
        listing_status: "active",
        limit: 100,
      });
      matches = (data.rwa_assets ?? [])
        .filter((item) =>
          [item.name, item.symbol].some((value) =>
            value?.toLowerCase().includes(needle),
          ),
        )
        .slice(0, Math.max(0, limit - results.length));
    }
    results.push(...matches.map(normalizeRwaAsset));
  }

  return results.slice(0, limit);
}

async function getOverview(limit: number) {
  const [globalData, cryptoAssets, rwaAssets] = await Promise.allSettled([
    cmcGet<CmcGlobal>("/v1/global-metrics/quotes/latest", { convert: "USD" }),
    fetchAssets("crypto", limit),
    fetchAssets("rwa", Math.min(limit, 8)),
  ]);

  if (globalData.status === "rejected") throw globalData.reason;
  if (cryptoAssets.status === "rejected") throw cryptoAssets.reason;

  const global = globalData.value.quote?.USD;
  const assets = [
    ...cryptoAssets.value,
    ...(rwaAssets.status === "fulfilled" ? rwaAssets.value : []),
  ];

  return GetMarketOverviewResponse.parse({
    asOf: new Date().toISOString(),
    totalMarketCap: numberOr(global?.total_market_cap),
    marketCapChange24h: numberOr(
      global?.total_market_cap_yesterday_percentage_change,
    ),
    totalVolume24h: numberOr(global?.total_volume_24h),
    btcDominance: numberOr(globalData.value.btc_dominance),
    assets,
    pulse: [
      {
        label: "Market cap",
        value: numberOr(global?.total_market_cap),
        change24h: numberOr(
          global?.total_market_cap_yesterday_percentage_change,
        ),
      },
      {
        label: "24h volume",
        value: numberOr(global?.total_volume_24h),
        change24h: numberOr(global?.total_volume_24h_yesterday_percentage_change),
      },
      {
        label: "BTC share",
        value: numberOr(globalData.value.btc_dominance),
        change24h: 0,
      },
    ],
    source: rwaAssets.status === "fulfilled" ? RWA_SOURCE : CMC_SOURCE,
  });
}

function sendExternalError(req: Request, res: Response, error: unknown) {
  req.log.error({ err: error }, "Market data request failed");
  const message =
    error instanceof Error ? error.message : "Market data is unavailable.";
  res.status(502).json({ error: message });
}

function buildDeterministicExplanation(
  overview: Awaited<ReturnType<typeof getOverview>>,
  asset: ExplanationAsset | undefined,
) {
  const marketDirection =
    overview.marketCapChange24h >= 0 ? "growing" : "cooling";
  const marketChange = Math.abs(overview.marketCapChange24h).toFixed(2);
  const assetMovement =
    asset?.change24h === null
      ? `${asset.name} has a live identity record, but CMC has not returned a quoted 24h move for this RWA endpoint yet`
      : asset
        ? `${asset.name} is ${asset.change24h >= 0 ? "up" : "down"} ${Math.abs(asset.change24h).toFixed(2)}% over the last 24 hours`
        : "";
  const assetPrice =
    asset?.price === null || asset?.price === undefined
      ? "its current quoted price is not reported by this source"
      : `its current price is $${asset.price.toLocaleString("en-US", { maximumFractionDigits: asset.price < 1 ? 6 : 2 })}`;

  return asset
    ? `${assetMovement}; ${assetPrice}. In context, the wider market is ${marketDirection} by ${marketChange}% today.`
    : `The wider market is ${marketDirection} by ${marketChange}% over the last 24 hours, with ${overview.btcDominance.toFixed(1)}% of the total market represented by Bitcoin. That is the useful starting point for your question; the numbers are live, but they are a snapshot rather than a prediction.`;
}

async function requestAgentRouterExplanation(
  question: string,
  overview: Awaited<ReturnType<typeof getOverview>>,
  asset: ExplanationAsset | undefined,
) {
  const token = process.env.AGENT_ROUTER_TOKEN;
  if (!token) return null;

  const context = {
    asOf: overview.asOf,
    marketCap: overview.totalMarketCap,
    marketCapChange24h: overview.marketCapChange24h,
    volume24h: overview.totalVolume24h,
    btcDominance: overview.btcDominance,
    selectedAsset: asset
      ? {
          name: asset.name,
          symbol: asset.symbol,
          kind: asset.kind,
          price: asset.price,
          change24h: asset.change24h,
          marketCap: asset.marketCap,
          volume24h: asset.volume24h,
          rank: asset.rank,
        }
      : null,
  };

  const response = await fetch("https://agentrouter.org/v1/chat/completions", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: process.env.AGENT_ROUTER_MODEL || "gpt-5",
      temperature: 0.2,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "Explain live market data in plain, calm language for someone who dislikes dense financial dashboards. Use only the supplied snapshot. Never invent missing values, never give investment advice, and mention when a field is unreported. Keep the answer under 90 words.",
        },
        {
          role: "user",
          content: `Question: ${question}\nSnapshot JSON: ${JSON.stringify(context)}`,
        },
      ],
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new ExternalApiError(
      `AgentRouter returned ${response.status} without a JSON response.`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const answer = payload.choices?.[0]?.message?.content;
  return typeof answer === "string" && answer.trim() ? answer.trim() : null;
}

router.get("/market/overview", async (req, res) => {
  const parsed = GetMarketOverviewQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid market overview parameters." });
    return;
  }

  try {
    res.json(await getOverview(parsed.data.limit));
  } catch (error) {
    sendExternalError(req, res, error);
  }
});

router.get("/market/assets", async (req, res) => {
  const parsed = GetMarketAssetsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid asset parameters." });
    return;
  }

  try {
    const assets = await fetchAssets(parsed.data.kind, parsed.data.limit);
    res.json(GetMarketAssetsResponse.parse(assets));
  } catch (error) {
    sendExternalError(req, res, error);
  }
});

router.get("/market/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const kind =
    req.query.kind === "crypto" || req.query.kind === "rwa"
      ? req.query.kind
      : undefined;
  const limit = Number(req.query.limit ?? 8);

  if (query.length < 2 || query.length > 80 || !Number.isInteger(limit) || limit < 3 || limit > 12) {
    res.status(400).json({ error: "Search needs 2–80 characters and a valid result limit." });
    return;
  }

  try {
    res.json(GetMarketAssetsResponse.parse(await searchAssets(query, kind, limit)));
  } catch (error) {
    sendExternalError(req, res, error);
  }
});

router.get("/market/assets/:symbol", async (req, res) => {
  const parsed = GetMarketAssetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid asset symbol." });
    return;
  }

  try {
    const symbol = parsed.data.symbol.toUpperCase();
    const [crypto, rwa] = await Promise.allSettled([
      fetchAssets("crypto", 100),
      fetchAssets("rwa", 100),
    ]);
    const match = [
      ...(crypto.status === "fulfilled" ? crypto.value : []),
      ...(rwa.status === "fulfilled" ? rwa.value : []),
    ].find((asset) => asset.symbol === symbol);

    if (!match) {
      res.status(404).json({ error: `No live asset found for ${symbol}.` });
      return;
    }
    res.json(GetMarketAssetResponse.parse(match));
  } catch (error) {
    sendExternalError(req, res, error);
  }
});

router.post("/market/explain", async (req, res) => {
  const parsed = ExplainMarketQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ask a question with at least 3 characters." });
    return;
  }

  try {
    const overview = await getOverview(8);
    const requestedSymbol = parsed.data.assetSymbol?.toUpperCase();
    const asset = requestedSymbol
      ? overview.assets.find((item) => item.symbol === requestedSymbol)
      : undefined;
    let answer = buildDeterministicExplanation(overview, asset);
    let source = overview.source;

    if (process.env.AGENT_ROUTER_TOKEN) {
      try {
        const agentAnswer = await requestAgentRouterExplanation(
          parsed.data.question,
          overview,
          asset,
        );
        if (agentAnswer) {
          answer = agentAnswer;
          source = `${overview.source} + AgentRouter`;
        }
      } catch (error) {
        req.log.warn(
          { err: error instanceof Error ? error.message : "unknown error" },
          "AgentRouter unavailable; using grounded fallback",
        );
      }
    }

    res.json(
      ExplainMarketQuestionResponse.parse({
        answer,
        question: parsed.data.question,
        asOf: overview.asOf,
        source,
      }),
    );
  } catch (error) {
    sendExternalError(req, res, error);
  }
});

export default router;
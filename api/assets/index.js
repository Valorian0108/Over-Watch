const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const assetColors = ["coral", "blue", "lime", "violet", "amber", "sky", "rose", "mint"];

function numberOr(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function colorFor(symbol) {
  const total = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return assetColors[total % assetColors.length];
}

function normalizeAsset(item, kind, index) {
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

async function cmcGet(path, queryParams) {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    throw new Error("CoinMarketCap API key is not configured.");
  }

  const url = new URL(`${CMC_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(queryParams)) {
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
    throw new Error(`CoinMarketCap returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const payload = await response.json();
  if (payload.data === undefined) {
    throw new Error(payload.status?.error_message ?? "CoinMarketCap returned no data.");
  }
  return payload.data;
}

async function fetchCryptoLogos(ids) {
  const logoMap = new Map();
  
  if (ids.length === 0) return logoMap;
  
  try {
    const info = await cmcGet("/v2/cryptocurrency/info", {
      id: ids.join(","),
    });
    
    for (const [idStr, assets] of Object.entries(info)) {
      const id = parseInt(idStr, 10);
      if (assets && assets[0]?.logo) {
        logoMap.set(id, assets[0].logo);
      }
    }
  } catch (error) {
    // Continue without logos
  }
  
  return logoMap;
}

async function fetchAssets(kind, limit) {
  if (kind === "crypto") {
    const data = await cmcGet("/v1/cryptocurrency/listings/latest", {
      start: 1,
      limit,
      convert: "USD",
    });
    
    const cryptoIds = data.map(item => item.id).filter((id) => id !== undefined);
    const logoMap = await fetchCryptoLogos(cryptoIds);
    
    return data.map((item, index) => normalizeAsset({
      ...item,
      logo: logoMap.get(item.id ?? 0) ?? item.logo,
    }, kind, index));
  }
  
  const data = await cmcGet("/v5/real-world-assets/map", {
    listing_status: "active",
    limit,
  });
  
  return data.rwa_assets?.map((item, index) => ({
    id: numberOr(item.rwa_id, index + 1),
    name: item.name || item.symbol || `RWA${index + 1}`,
    symbol: item.symbol?.toUpperCase() || `RWA${index + 1}`,
    kind: "rwa",
    price: null,
    change24h: null,
    marketCap: null,
    volume24h: null,
    rank: item.rwa_rank ?? null,
    color: colorFor(item.symbol || `RWA${index + 1}`),
    imageUrl: null,
  })) || [];
}

module.exports = async function handler(req, res) {
  const { method, url } = req;
  const urlObj = new URL(url, `http://${req.headers.host}`);
  const query = urlObj.searchParams;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const kind = query.get('kind') === 'crypto' || query.get('kind') === 'rwa' ? query.get('kind') : undefined;
    const limit = parseInt(query.get('limit')) || 8;
    const assets = await fetchAssets(kind, limit);
    res.json(assets);
  } catch (error) {
    console.error('Assets API error:', error);
    res.status(502).json({ error: error.message || 'Assets data is unavailable.' });
  }
};
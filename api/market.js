export default async function handler(req, res) {
  const { method, url } = req;
  const { query } = new URL(url);
  
  const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
  const assetColors = ["coral", "blue", "lime", "violet", "amber", "sky", "rose", "mint"];

  // Helper functions
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

  function normalizeRwaAsset(item, index, logoUrl = null) {
    const symbol = item.symbol?.toUpperCase() || `RWA${index + 1}`;
    return {
      id: numberOr(item.rwa_id, index + 1),
      name: item.name || symbol,
      symbol,
      kind: "rwa",
      price: null,
      change24h: null,
      marketCap: null,
      volume24h: null,
      rank: item.rwa_rank ?? null,
      color: colorFor(symbol),
      imageUrl: logoUrl,
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

  async function fetchCryptoIdForRwa(rwaId) {
    try {
      const issuers = await cmcGet("/v5/real-world-assets/issuers", {
        rwa_id: rwaId,
      });
      
      for (const issuer of issuers.issuers ?? []) {
        for (const token of issuer.tokens ?? []) {
          if (token.crypto_id) {
            return token.crypto_id;
          }
        }
      }
      return null;
    } catch (error) {
      return null;
    }
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

  async function fetchRwaLogos(rwaIds) {
    const logoMap = new Map();
    
    if (rwaIds.length === 0) return logoMap;
    
    try {
      const info = await cmcGet("/v5/real-world-assets/info", {
        rwa_id: rwaIds.join(","),
      });
      
      for (const asset of info.data ?? []) {
        if (asset.rwa_id && asset.about?.logo) {
          logoMap.set(asset.rwa_id, asset.about.logo);
        }
      }
    } catch (error) {
      // Continue without logos
    }
    
    return logoMap;
  }

  async function fetchRwaWithLivePricing(rwaAssets) {
    const rwaIds = rwaAssets.map(item => item.rwa_id).filter((id) => id !== undefined);
    const rwaLogoMap = await fetchRwaLogos(rwaIds);
    
    const enhancedAssets = await Promise.all(
      rwaAssets.map(async (rwa, index) => {
        const cryptoId = await fetchCryptoIdForRwa(rwa.rwa_id ?? 0);
        
        if (cryptoId) {
          try {
            const quotes = await cmcGet("/v2/cryptocurrency/quotes/latest", {
              id: cryptoId,
              convert: "USD",
            });
            
            const cryptoData = quotes[cryptoId]?.[0];
            if (cryptoData) {
              return normalizeAsset(
                {
                  ...cryptoData,
                  name: rwa.name || cryptoData.name,
                  symbol: rwa.symbol || cryptoData.symbol,
                  cmc_rank: rwa.rwa_rank ?? cryptoData.cmc_rank,
                  logo: rwaLogoMap.get(rwa.rwa_id ?? 0) ?? cryptoData.logo,
                },
                "rwa",
                index,
              );
            }
          } catch (error) {
            // Fall back to metadata-only
          }
        }
        
        return {
          ...normalizeRwaAsset(rwa, index),
          imageUrl: rwaLogoMap.get(rwa.rwa_id ?? 0) ?? null,
        };
      }),
    );
    
    return enhancedAssets;
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
    return await fetchRwaWithLivePricing(data.rwa_assets ?? []);
  }

  async function getOverview(limit) {
    const [globalData, cryptoAssets, rwaAssets] = await Promise.allSettled([
      cmcGet("/v1/global-metrics/quotes/latest", { convert: "USD" }),
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

    return {
      asOf: new Date().toISOString(),
      totalMarketCap: numberOr(global?.total_market_cap),
      marketCapChange24h: numberOr(global?.total_market_cap_yesterday_percentage_change),
      totalVolume24h: numberOr(global?.total_volume_24h),
      btcDominance: numberOr(globalData.value.btc_dominance),
      assets,
      pulse: [
        {
          label: "Market cap",
          value: numberOr(global?.total_market_cap),
          change24h: numberOr(global?.total_market_cap_yesterday_percentage_change),
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
      source: rwaAssets.status === "fulfilled" 
        ? "CoinMarketCap · /v1/global-metrics/quotes/latest + /v1/cryptocurrency/listings/latest + /v5/real-world-assets/map + /v5/real-world-assets/issuers + /v2/cryptocurrency/quotes/latest"
        : "CoinMarketCap · /v1/global-metrics/quotes/latest + /v1/cryptocurrency/listings/latest",
    };
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const path = url.split('/').filter(Boolean);

    if (path[0] === 'healthz') {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    else if (path[0] === 'market' && path[1] === 'overview') {
      const limit = parseInt(query.get('limit')) || 8;
      const overview = await getOverview(limit);
      res.json(overview);
    }
    else if (path[0] === 'market' && path[1] === 'assets') {
      if (path[2]) {
        // Single asset
        const symbol = path[2].toUpperCase();
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
        res.json(match);
      } else {
        // List assets
        const kind = query.get('kind') === 'crypto' || query.get('kind') === 'rwa' ? query.get('kind') : undefined;
        const limit = parseInt(query.get('limit')) || 8;
        const assets = await fetchAssets(kind, limit);
        res.json(assets);
      }
    }
    else if (path[0] === 'market' && path[1] === 'explain' && method === 'POST') {
      const body = await req.json();
      const { question, assetSymbol } = body;
      
      if (!question || question.length < 3) {
        res.status(400).json({ error: "Ask a question with at least 3 characters." });
        return;
      }

      const overview = await getOverview(8);
      const requestedSymbol = assetSymbol?.toUpperCase();
      const asset = requestedSymbol
        ? overview.assets.find((item) => item.symbol === requestedSymbol)
        : undefined;

      // Deterministic explanation
      const marketDirection = overview.marketCapChange24h >= 0 ? "growing" : "cooling";
      const marketChange = Math.abs(overview.marketCapChange24h).toFixed(2);
      const assetMovement = asset?.change24h === null
        ? `${asset.name} has a live identity record, but live pricing data is not currently available for this asset`
        : asset
          ? `${asset.name} is ${asset.change24h >= 0 ? "up" : "down"} ${Math.abs(asset.change24h).toFixed(2)}% over the last 24 hours`
          : "";
      const assetPrice = asset?.price === null || asset?.price === undefined
        ? "its current quoted price is not reported by this source"
        : `its current price is $${asset.price.toLocaleString("en-US", { maximumFractionDigits: asset.price < 1 ? 6 : 2 })}`;

      const answer = asset
        ? `${assetMovement}; ${assetPrice}. In context, the wider market is ${marketDirection} by ${marketChange}% today.`
        : `The wider market is ${marketDirection} by ${marketChange}% over the last 24 hours, with ${overview.btcDominance.toFixed(1)}% of the total market represented by Bitcoin.`;

      res.json({
        answer,
        question,
        asOf: overview.asOf,
        source: overview.source,
      });
    }
    else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(502).json({ error: error.message || 'Market data is unavailable.' });
  }
}
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";

function numberOr(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

async function getOverview(limit) {
  const [globalData, cryptoData] = await Promise.allSettled([
    cmcGet("/v1/global-metrics/quotes/latest", { convert: "USD" }),
    cmcGet("/v1/cryptocurrency/listings/latest", { start: 1, limit, convert: "USD" }),
  ]);

  if (globalData.status === "rejected") throw globalData.reason;
  if (cryptoData.status === "rejected") throw cryptoData.reason;

  const global = globalData.value.quote?.USD;
  const assets = cryptoData.value.map((item, index) => ({
    id: numberOr(item.id, index + 1),
    name: item.name,
    symbol: item.symbol?.toUpperCase(),
    kind: "crypto",
    price: item.quote?.USD?.price ?? null,
    change24h: item.quote?.USD?.percent_change_24h ?? null,
  }));

  return {
    asOf: new Date().toISOString(),
    totalMarketCap: numberOr(global?.total_market_cap),
    marketCapChange24h: numberOr(global?.total_market_cap_yesterday_percentage_change),
    btcDominance: numberOr(globalData.value.btc_dominance),
    assets,
  };
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
    let question, assetSymbol;
    
    if (method === 'POST') {
      // Parse body manually if not already parsed
      if (req.body && typeof req.body === 'object') {
        question = req.body.question;
        assetSymbol = req.body.assetSymbol;
      } else {
        try {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          await new Promise(resolve => req.on('end', resolve));
          const parsed = JSON.parse(body);
          question = parsed.question;
          assetSymbol = parsed.assetSymbol;
        } catch (parseError) {
          console.error('Body parse error:', parseError);
          res.status(400).json({ error: "Invalid JSON body" });
          return;
        }
      }
    } else {
      question = query.get('q') || 'What is the market doing?';
      assetSymbol = query.get('symbol');
    }
    
    if (!question || question.length < 3) {
      res.status(400).json({ error: "Ask a question with at least 3 characters." });
      return;
    }

    const overview = await getOverview(8);
    const requestedSymbol = assetSymbol?.toUpperCase();
    const asset = requestedSymbol
      ? overview.assets.find((item) => item.symbol === requestedSymbol)
      : undefined;

    // Simple plain-language explanation
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
      source: "CoinMarketCap · Simple plain-language explanations",
    });
  } catch (error) {
    console.error('Explain API error:', error);
    res.status(502).json({ error: error.message || 'Explanation unavailable.' });
  }
};
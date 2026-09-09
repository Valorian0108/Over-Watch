const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

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

async function callGroq(question, marketContext) {
  console.log('Groq API Key check:', GROQ_API_KEY ? 'Present' : 'Missing');
  console.log('Groq API Key length:', GROQ_API_KEY?.length || 0);
  
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key is not configured.");
  }

  const prompt = `Answer this market question in 1-2 sentences using this data: ${marketContext}. Question: ${question}`;
  
  const response = await fetch(GROQ_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
      top_p: 1,
      stream: false,
      stop: null
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Groq API error details:', error);
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Groq API response:', data);
  const answer = data.choices?.[0]?.message?.content;
  
  if (!answer) {
    throw new Error("No response from Groq");
  }
  
  return answer.trim();
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
      question = req.body?.question;
      assetSymbol = req.body?.assetSymbol;
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

    // Build market context for Gemini
    const marketDirection = overview.marketCapChange24h >= 0 ? "growing" : "cooling";
    const marketChange = Math.abs(overview.marketCapChange24h).toFixed(2);
    const assetContext = asset
      ? `${asset.name} (${asset.symbol}) is ${asset.change24h >= 0 ? "up" : "down"} ${Math.abs(asset.change24h).toFixed(2)}%`
      : "";
    
    const marketContext = `Market: ${marketDirection} ${marketChange}% today. ${assetContext}`;

    try {
      const answer = await callGroq(question, marketContext);
      
      res.json({
        answer,
        question,
        asOf: overview.asOf,
        source: "Groq AI · Live market data",
      });
    } catch (groqError) {
      console.error('Groq error, falling back to simple response:', groqError);
      console.error('Error details:', groqError.message);
      
      // Fallback to simple response if Gemini fails
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
        source: "CoinMarketCap · Simple plain-language explanations (AI unavailable)",
      });
    }
  } catch (error) {
    console.error('Explain API error:', error);
    res.status(502).json({ error: error.message || 'Explanation unavailable.' });
  }
};
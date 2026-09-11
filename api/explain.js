const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const EXPLABS_API_KEY = process.env.EXPLABS_API_KEY;
const EXPLABS_BASE_URL = "https://api.experientiallabs.ai/v1/chat/completions";
const QWEN_API_KEY = process.env.QWEN_API_KEY;
const QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY;
const CRYPTOCOMPARE_BASE_URL = "https://min-api.cryptocompare.com/data";

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
  const [globalData, cryptoData, rwaData] = await Promise.allSettled([
    cmcGet("/v1/global-metrics/quotes/latest", { convert: "USD" }),
    cmcGet("/v1/cryptocurrency/listings/latest", { start: 1, limit, convert: "USD" }),
    cmcGet("/v5/real-world-assets/assets/list", { listing_status: "active", limit: 20 }),
  ]);

  if (globalData.status === "rejected") throw globalData.reason;
  if (cryptoData.status === "rejected") throw cryptoData.reason;

  const global = globalData.value.quote?.USD;

  // Process crypto assets
  const cryptoAssets = cryptoData.value.map((item, index) => ({
    id: numberOr(item.id, index + 1),
    name: item.name,
    symbol: item.symbol?.toUpperCase(),
    kind: "crypto",
    price: item.quote?.USD?.price ?? null,
    change24h: item.quote?.USD?.percent_change_24h ?? null,
    change7d: item.quote?.USD?.percent_change_7d ?? null,
    change30d: item.quote?.USD?.percent_change_30d ?? null,
    marketCap: item.quote?.USD?.market_cap ?? null,
    volume24h: item.quote?.USD?.volume_24h ?? null,
    rank: item.cmc_rank ?? null,
  }));

  // Process RWA assets
  let rwaAssets = [];
  if (rwaData.status === "fulfilled") {
    const rwaList = rwaData.value.rwa_assets ?? [];
    rwaAssets = rwaList.map((item, index) => {
      const usdQuote = item.quotes?.find(q => q.symbol === "USD");
      return {
        id: numberOr(item.rwa_id, index + 1000),
        name: item.name || item.symbol || `RWA${index + 1}`,
        symbol: item.symbol?.toUpperCase() || `RWA${index + 1}`,
        kind: "rwa",
        price: usdQuote?.average_tokenized_price ?? null,
        change24h: null, // RWA quotes don't include 24h change in this endpoint
        change7d: null,
        change30d: null,
        marketCap: usdQuote?.tokenized_market_cap ?? null,
        volume24h: usdQuote?.tokenized_volume_24h ?? null,
        rank: item.rwa_rank ?? null,
      };
    });
  }

  // Combine both asset types
  const assets = [...cryptoAssets, ...rwaAssets];

  return {
    asOf: new Date().toISOString(),
    totalMarketCap: numberOr(global?.total_market_cap),
    marketCapChange24h: numberOr(global?.total_market_cap_yesterday_percentage_change),
    totalVolume24h: numberOr(global?.total_volume_24h),
    btcDominance: numberOr(globalData.value.btc_dominance),
    assets,
  };
}

async function callExperientialLabs(question, marketContext) {
  console.log('Experiential Labs API Key check:', EXPLABS_API_KEY ? 'Present' : 'Missing');
  console.log('Experiential Labs API Key length:', EXPLABS_API_KEY?.length || 0);

  if (!EXPLABS_API_KEY) {
    throw new Error("Experiential Labs API key is not configured.");
  }

  const systemPrompt = `You are a helpful financial assistant that explains cryptocurrency and RWA market data in simple, clear language for users who find complex financial terminology overwhelming.

YOU HAVE ACCESS TO:
- Current prices for top 50 crypto assets
- Market caps, volumes, and rankings
- Historical trends (24h, 7d, 30d changes)
- Recent news headlines and context
- Overall market state and BTC dominance

YOUR SCOPE (what you CAN answer):
- Current prices of any asset in the dataset
- What the numbers mean in practical terms
- Context about market movements using news when available
- Comparisons between current and recent performance
- Whether movements are significant or normal
- Simple analogies to help understand market behavior
- Recent news context when available

YOUR LIMITATIONS (what you CANNOT do):
- NEVER give trading signals, investment advice, or tell users what to buy/sell
- NEVER make predictions about future prices
- NEVER provide financial recommendations
- If asked for trading advice: "I can't give trading advice. I can help you understand what the current market numbers mean."
- If asked for predictions: "I can't predict future prices. I can tell you about current market conditions."
- Never make up data - only use what's provided

HOW TO RESPOND:
- Be conversational and direct - use "this could mean..." instead of vague "suggesting" language
- Use everyday analogies (weather, temperature, traffic patterns)
- Explain what percentages mean in practical terms
- Give context about what's normal vs unusual in crypto markets
- Use news headlines to provide context for market movements when available
- Don't overwhelm with numbers - focus on the story the numbers tell
- Be helpful and informative rather than constantly saying "I don't have that data"
- If asked for basic price info, provide it directly: "BTC is currently trading at $X"
- If asked "what's happening" with an asset, use both numbers and news to tell the story

Example good response: "BTC is currently trading at $65,000. It's down 5% today but up 10% this week. Recent news suggests this could be related to the ETF approval announcement."`;

  const userPrompt = `MARKET DATA:
${marketContext}

User question: ${question}

Answer directly and concisely. Use the data provided. Be conversational but brief. Under 2 sentences if possible.`;

  const response = await fetch(EXPLABS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EXPLABS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen3.8-27b",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Experiential Labs API error details:', error);
    throw new Error(`Experiential Labs API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Experiential Labs API response:', JSON.stringify(data, null, 2));

  // The response structure shows message is an object, need to handle it properly
  let answer;
  const choice = data.choices?.[0];
  if (choice) {
    // Handle both string and object message content
    if (typeof choice.message?.content === 'string' && choice.message.content) {
      answer = choice.message.content;
    } else if (choice.message?.content) {
      // If content is an object, try to extract text
      answer = JSON.stringify(choice.message.content);
    } else if (choice.finish_reason === 'length') {
      // If it hit token limit but produced no content, throw error to trigger fallback
      console.error('API hit token limit but produced no content');
      throw new Error("Experiential Labs hit token limit without producing content");
    }
  }

  if (!answer) {
    console.error('Response structure:', JSON.stringify(data, null, 2));
    throw new Error("No response from Experiential Labs");
  }

  return answer.trim();
}

async function callQwen(question, marketContext) {
  console.log('Qwen API Key check:', QWEN_API_KEY ? 'Present' : 'Missing');
  console.log('Qwen API Key length:', QWEN_API_KEY?.length || 0);

  if (!QWEN_API_KEY) {
    throw new Error("Qwen API key is not configured.");
  }

  const systemPrompt = `You are a helpful financial assistant that explains cryptocurrency and RWA market data in simple, clear language for users who find complex financial terminology overwhelming.

YOU HAVE ACCESS TO:
- Current prices for top 100 crypto assets
- Market caps, volumes, and rankings
- Historical trends (24h, 7d, 30d changes)
- Recent news headlines and context
- Overall market state and BTC dominance

YOUR SCOPE (what you CAN answer):
- Current prices of any asset in the dataset
- What the numbers mean in practical terms
- Context about market movements using news when available
- Comparisons between current and recent performance
- Whether movements are significant or normal
- Simple analogies to help understand market behavior

YOUR LIMITATIONS (what you CANNOT do):
- NEVER give trading signals, investment advice, or tell users what to buy/sell
- NEVER make predictions about future prices
- NEVER provide financial recommendations
- If asked for trading advice: "I can't give trading advice. I can help you understand what the current market numbers mean."
- If asked for predictions: "I can't predict future prices. I can tell you about current market conditions."
- Never make up data - only use what's provided

HOW TO RESPOND:
- Be conversational and direct - use "this could mean..." instead of vague "suggesting" language
- Use everyday analogies (weather, temperature, traffic patterns)
- Explain what percentages mean in practical terms
- Give context about what's normal vs unusual in crypto markets
- Use news headlines to provide context for market movements when available
- Don't overwhelm with numbers - focus on the story the numbers tell
- Be helpful and informative rather than constantly saying "I don't have that data"
- If asked for basic price info, provide it directly: "BTC is currently trading at $X"
- If asked "what's happening" with an asset, use both numbers and news to tell the story

Example good response: "BTC is currently trading at $65,000. It's down 5% today but up 10% this week. Recent news suggests this could be related to the ETF approval announcement."`;

  const userPrompt = `MARKET DATA:
${marketContext}

User question: ${question}

Answer directly and concisely. Use the data provided. Be conversational but brief. Under 2 sentences if possible.`;

  const response = await fetch(QWEN_BASE_URL + "/chat/completions", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen3.8-27b",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Qwen API error details:', error);
    throw new Error(`Qwen API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Qwen API response:', JSON.stringify(data, null, 2));

  const answer = data.choices?.[0]?.message?.content;

  if (!answer) {
    console.error('Response structure:', JSON.stringify(data, null, 2));
    throw new Error("No response from Qwen");
  }

  return answer.trim();
}

async function getNewsForAsset(symbol) {
  try {
    if (!CRYPTOCOMPARE_API_KEY) {
      return [];
    }

    const url = new URL(`${CRYPTOCOMPARE_BASE_URL}/v2/news/`);
    url.searchParams.set('lang', 'EN');
    url.searchParams.set('sortOrder', 'latest');
    url.searchParams.set('categories', symbol === 'BTC' ? 'BTC,General' : 'General');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Apikey ${CRYPTOCOMPARE_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error('CryptoCompare API error:', response.status);
      return [];
    }

    const data = await response.json();
    const news = data.Data?.slice(0, 5) || [];

    return news.map(item => ({
      title: item.title,
      body: item.body,
      url: item.url,
      publishedAt: item.published_on,
    }));
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
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
    let question;

    if (method === 'POST') {
      question = req.body?.question;
    } else {
      question = query.get('q') || 'What is the market doing?';
    }

    if (!question || question.length < 3) {
      res.status(400).json({ error: "Ask a question with at least 3 characters." });
      return;
    }

    const overview = await getOverview(100);

    // Extract asset symbol from question text instead of using UI selection
    function extractSymbolFromQuestion(questionText, availableAssets) {
      const questionLower = questionText.toLowerCase();

      // Create a map of symbol -> asset and name -> asset
      const symbolMap = new Map();
      const nameMap = new Map();

      for (const asset of availableAssets) {
        symbolMap.set(asset.symbol.toLowerCase(), asset);
        nameMap.set(asset.name.toLowerCase(), asset);
      }

      // Check for exact symbol matches first (BTC, ETH, ZEC, etc.)
      for (const [symbol, asset] of symbolMap) {
        if (questionLower.includes(symbol)) {
          return asset;
        }
      }

      // Check for name matches (Bitcoin, Ethereum, Zcash, etc.)
      for (const [name, asset] of nameMap) {
        if (questionLower.includes(name)) {
          return asset;
        }
      }

      return null;
    }

    const extractedAsset = extractSymbolFromQuestion(question, overview.assets);
    const asset = extractedAsset || undefined;

    // Fetch news if asking about a specific asset
    let news = [];
    if (asset) {
      news = await getNewsForAsset(asset.symbol);
    }

    // Build simplified market context
    const marketCapChange24h = overview.marketCapChange24h ?? 0;
    const marketDirection = marketCapChange24h >= 0 ? "up" : "down";
    const marketChange = Math.abs(marketCapChange24h).toFixed(2);

    let assetDetails = "";
    if (asset) {
      const asset24h = asset.change24h ?? 0;
      const trend24h = asset24h >= 0 ? "up" : "down";
      assetDetails = `${asset.name} is ${trend24h} ${Math.abs(asset24h).toFixed(2)}% today, price: $${asset.price ? asset.price.toLocaleString('en-US', { maximumFractionDigits: asset.price < 1 ? 6 : 2 }) : 'N/A'}`;
    }

    let newsContext = "";
    if (news.length > 0) {
      newsContext = `Recent news: ${news[0].title}`;
    }

    const marketContext = `Market: ${marketDirection} ${marketChange}% today. ${assetDetails} ${newsContext}`;

    try {
      const answer = await callExperientialLabs(question, marketContext);

      res.json({
        answer,
        question,
        asOf: overview.asOf,
        source: "Experiential Labs AI · Live market data with news context",
      });
    } catch (explabsError) {
      console.error('Experiential Labs error, trying Qwen fallback:', explabsError);
      console.error('Error details:', explabsError.message);

      try {
        const answer = await callQwen(question, marketContext);

        res.json({
          answer,
          question,
          asOf: overview.asOf,
          source: "Qwen AI (Bitget Eco) · Live market data with news context",
        });
      } catch (qwenError) {
        console.error('Qwen also failed, falling back to simple response:', qwenError);
        console.error('Error details:', qwenError.message);

      // Fallback to simple response if Experiential Labs fails
      const assetMovement = asset?.change24h === null
        ? `${asset.name} has a live identity record, but live pricing data is not currently available for this asset`
        : asset
          ? `${asset.name} is ${asset.change24h >= 0 ? "up" : "down"} ${Math.abs(asset.change24h).toFixed(2)}% today`
          : "";
      const assetTrend = asset?.change7d !== null && asset?.change30d !== null
        ? `, ${asset?.change7d >= 0 ? "up" : "down"} ${Math.abs(asset?.change7d).toFixed(2)}% this week, and ${asset?.change30d >= 0 ? "up" : "down"} ${Math.abs(asset?.change30d).toFixed(2)}% this month`
        : "";
      const assetPrice = asset?.price === null || asset?.price === undefined
        ? "its current quoted price is not reported by this source"
        : `its current price is $${asset.price.toLocaleString("en-US", { maximumFractionDigits: asset.price < 1 ? 6 : 2 })}`;

      const answer = asset
        ? `${assetMovement}${assetTrend}; ${assetPrice}. In context, the wider market is ${marketDirection} by ${marketChange}% today.`
        : `The wider market is ${marketDirection} by ${marketChange}% over the last 24 hours, with ${overview.btcDominance ? overview.btcDominance.toFixed(1) + '%' : 'not available'} of the total market represented by Bitcoin.`;

      res.json({
        answer,
        question,
        asOf: overview.asOf,
        source: "CoinMarketCap · Plain-language explanations with news context (AI unavailable)",
      });
    }
  } catch (error) {
    console.error('Explain API error:', error);
    res.status(502).json({ error: error.message || 'Explanation unavailable.' });
  }
};
module.exports = async function handler(req, res) {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.COINMARKETCAP_API_KEY 
  });
};
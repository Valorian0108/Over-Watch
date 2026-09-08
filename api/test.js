module.exports = async function handler(req, res) {
  console.log('Test endpoint called');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Has API key:', !!process.env.COINMARKETCAP_API_KEY);
  
  res.json({
    status: 'ok',
    message: 'Serverless function is working',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.COINMARKETCAP_API_KEY,
    envKeys: Object.keys(process.env).filter(k => k.includes('CMC') || k.includes('API'))
  });
};
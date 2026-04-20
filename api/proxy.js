// Pas besoin de require('node-fetch') sur Node 18+
module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(decodeURIComponent(url));
    const data = await response.json();

    // On ajoute les headers CORS pour autoriser votre propre site
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
};

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

    // Ajout d'un cache via le CDN de Vercel
    // s-maxage=86400 : Vercel garde le résultat en mémoire pendant 24h
    // stale-while-revalidate=43200 : Si le cache expire, Vercel sert l'ancien résultat et va chercher
    //  le nouveau en arrière-plan
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
};

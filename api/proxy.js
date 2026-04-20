module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // SECURITE (SRP) : Ce proxy est dédié uniquement au SITG.
  // On bloque toute tentative d'utiliser notre serveur Vercel pour attaquer d'autres sites (SSRF).
  if (!url.startsWith('https://vector.sitg.ge.ch/')) {
    return res.status(403).json({ error: 'Accès refusé. Ce proxy est réservé aux données de l\'État de Genève.' });
  }

  try {
    /**
     * Compression : On demande explicitement au SITG de renvoyer les données
     * compressées (gzip ou brotli). Node.js / Vercel décompresse automatiquement
     * la réponse avant qu'elle ne soit lue par response.json().
     * Cela peut réduire la bande passante de 60 à 80% sur les grandes requêtes BBOX.
     */
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept'         : 'application/json',
      },
    });
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

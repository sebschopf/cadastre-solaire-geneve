/**
 * apiService.js
 * Responsabilité (SRP) : Gérer exclusivement les appels réseau vers l'API du SITG.
 * Contient la logique d'optimisation (Debounce, AbortController, Cache rounding).
 */

let currentAbortController = null;

/**
 * Arrondit les coordonnées pour augmenter le taux de hit du cache Vercel
 * @param {number} num Coordonnée
 * @param {number} precision Nombre de décimales (3 = ~100m, 4 = ~11m)
 * @returns {number}
 */
const roundCoord = (num, precision = 4) => {
    return Number(num.toFixed(precision));
};

/**
 * Récupère les bâtiments dans une BBOX donnée.
 * Annule automatiquement la requête précédente si elle est encore en cours.
 * 
 * @param {Object} bounds L'objet bounds de Leaflet
 * @returns {Promise<Array>} Un tableau de features (GeoJSON) ou null si annulé.
 */
export async function fetchBuildings(bounds) {
    // 1. AbortController : Annuler la requête précédente en vol
    if (currentAbortController) {
        currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // 2. Cache Rounding : Arrondir la BBOX pour "grouper" les requêtes similaires
    const west = roundCoord(bounds.getWest());
    const south = roundCoord(bounds.getSouth());
    const east = roundCoord(bounds.getEast());
    const north = roundCoord(bounds.getNorth());
    const bbox = `${west},${south},${east},${north}`;

    const sitgUrl = `https://vector.sitg.ge.ch/arcgis/rest/services/OCEN_SOLAIRE_PV_BATIMENT/FeatureServer/0/query?geometry=${bbox}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OBJECTID,ADRESSE,PV_AN_TOT,CO2,INVEST_TOT,GAINS_AN,PATRIM&outSR=4326&f=geojson`;
    const url = `/api/proxy?url=${encodeURIComponent(sitgUrl)}`;

    try {
        const response = await fetch(url, { signal });
        
        if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.status}`);
        }
        
        const data = await response.json();
        return data.features || [];
        
    } catch (error) {
        if (error.name === 'AbortError') {
            // La requête a été annulée par une nouvelle requête, c'est normal.
            console.log("Requête SITG annulée (l'utilisateur bouge encore la carte).");
            return null;
        }
        console.error("Erreur lors de la récupération des bâtiments :", error);
        return [];
    }
}

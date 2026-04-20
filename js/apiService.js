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

    /**
     * Champs demandés au SITG.
     * On ne demande que ce dont on a besoin (principe du moindre privilège).
     * Ajout de : TRI (officiel), COMMUNE, AREA_PV_TOT, AREA_TOIT, P_KWC_TOT, SUB_AC_TOT, CONSO_PR
     */
    const FIELDS = [
        'OBJECTID', 'ADRESSE', 'COMMUNE',
        'PV_AN_TOT', 'CO2', 'P_KWC_TOT',
        'AREA_PV_TOT', 'AREA_TOIT',
        'INVEST_TOT', 'GAINS_AN', 'SUB_AC_TOT',
        'CONSO_PR', 'TRI', 'PATRIM',
    ].join(',');

    const sitgUrl = `https://vector.sitg.ge.ch/arcgis/rest/services/OCEN_SOLAIRE_PV_BATIMENT/FeatureServer/0/query?geometry=${bbox}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${FIELDS}&outSR=4326&f=geojson`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(sitgUrl)}`;

    try {
        // Tentative via le proxy (Vercel)
        let response = await fetch(proxyUrl, { signal });

        // Si le proxy est absent (ex: dev local avec 'serve'), on tente l'appel direct
        if (response.status === 404) {
            console.warn("[apiService] Proxy absent (404). Tentative d'appel direct au SITG...");
            response = await fetch(sitgUrl, { signal });
        }

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

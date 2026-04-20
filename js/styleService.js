/**
 * @module styleService
 * @description Responsabilité unique (SRP) : Calcul du style visuel des polygones de bâtiment.
 *
 * Ce module détermine la couleur et l'apparence d'un bâtiment en fonction
 * du thème actif (ROI ou Production). Il est conçu pour être pur : ses fonctions
 * ne produisent aucun effet de bord et retournent toujours un objet de style Leaflet.
 *
 * Pour ajouter un nouveau thème de colorisation, il suffit d'étendre les fonctions
 * internes sans toucher à l'interface publique (Open/Closed Principle).
 */

// ---------------------------------------------------------------------------
// Calculateurs de couleur par thème (fonctions pures, non exportées)
// ---------------------------------------------------------------------------

/**
 * Calcule la couleur d'un bâtiment selon le thème "Retour sur Investissement".
 * @param {Object} props - Les propriétés GeoJSON du bâtiment.
 * @returns {string} Un code couleur hexadécimal.
 */
const getColorByROI = (props) => {
    const invest = props.INVEST_TOT || 0;
    const gains = props.GAINS_AN || 0;

    if (invest <= 0 || gains <= 0) return '#ef4444'; // ROI incalculable -> rouge

    const roi = invest / gains;
    if (roi < 10) return '#10b981'; // Excellent : vert
    if (roi < 20) return '#fcd34d'; // Bon       : jaune
    if (roi < 30) return '#f59e0b'; // Moyen     : orange
    return '#ef4444';               // Long      : rouge
};

/**
 * Calcule la couleur d'un bâtiment selon le thème "Production d'énergie".
 * @param {Object} props - Les propriétés GeoJSON du bâtiment.
 * @returns {string} Un code couleur hexadécimal.
 */
const getColorByProduction = (props) => {
    const prodMwh = props.PV_AN_TOT ? props.PV_AN_TOT / 1000 : 0;
    if (prodMwh > 50) return '#047857'; // Énorme : vert foncé
    if (prodMwh > 20) return '#10b981'; // Grand  : vert
    if (prodMwh > 5) return '#6ee7b7'; // Moyen  : vert clair
    return '#f1f5f9';                   // Faible : gris
};

// ---------------------------------------------------------------------------
// Export public
// ---------------------------------------------------------------------------

/**
 * Retourne l'objet de style Leaflet pour un bâtiment donné.
 *
 * Les bâtiments soumis au patrimoine (PATRIM === 1) reçoivent un style
 * spécifique (hachuré) indépendamment du thème actif.
 *
 * @param {Object} feature  - Un objet Feature GeoJSON.
 * @param {string} theme    - Le thème actif ('roi' ou 'production').
 * @param {boolean} isHover - Vrai si le curseur survole le bâtiment.
 * @returns {Object} Un objet de style compatible avec l'API Leaflet.
 */
export function getStyleForFeature(feature, theme, isHover = false) {
    const props = feature.properties;
    const isPatrim = props.PATRIM === 1;

    const fillColor = isPatrim
        ? '#cbd5e1'
        : (theme === 'production' ? getColorByProduction(props) : getColorByROI(props));

    return {
        color: isHover ? '#0f172a' : (isPatrim ? '#94a3b8' : fillColor),
        weight: isHover ? 2 : 1,
        fillColor,
        fillOpacity: isHover ? 0.9 : 0.7,
        dashArray: isPatrim ? '4,4' : '',
    };
}

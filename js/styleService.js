/**
 * @module styleService
 * @description Responsabilité unique (SRP) : Calcul du style visuel des polygones de bâtiment.
 *
 * Ce module détermine la couleur et l'apparence d'un bâtiment en fonction
 * du thème actif (ROI ou Production). Il est conçu pour être pur : ses fonctions
 * ne produisent aucun effet de bord et retournent toujours un objet de style Leaflet.
 *
 * Toutes les couleurs sont lues depuis le système de tokens OKLCH (CSS :root)
 * via le module colorPalette — source unique de vérité. Aucune couleur n'est
 * déclarée ici en dur.
 *
 * Pour ajouter un nouveau thème de colorisation, il suffit d'étendre les fonctions
 * internes sans toucher à l'interface publique (Open/Closed Principle).
 *
 * @requires colorPalette.js
 */

import { mapColors } from './colorPalette.js';

// ---------------------------------------------------------------------------
// Calculateurs de couleur par thème (fonctions pures, non exportées)
// ---------------------------------------------------------------------------

/**
 * Calcule la couleur d'un bâtiment selon le thème "Retour sur Investissement".
 * Utilise le champ TRI (officiel G2 Solaire) si disponible, sinon approximation.
 *
 * @param {Object} props - Les propriétés GeoJSON du bâtiment.
 * @returns {string} Une couleur OKLCH via le module colorPalette.
 */
const getColorByROI = (props) => {
    // Préférer le TRI officiel (champ calculé par G2 Solaire, plus précis)
    const invest = props.INVEST_TOT || 0;
    const gains  = props.GAINS_AN  || 0;
    const tri    = props.TRI;

    // TRI officiel disponible → on l'utilise
    if (tri && tri > 0 && tri < 999) {
        if (tri < 10) return mapColors.roi.excellent;
        if (tri < 20) return mapColors.roi.good;
        if (tri < 30) return mapColors.roi.medium;
        return mapColors.roi.long;
    }

    // Fallback : approximation INVEST / GAINS
    if (invest <= 0 || gains <= 0) return mapColors.roi.unknown;
    const approx = invest / gains;
    if (approx < 10) return mapColors.roi.excellent;
    if (approx < 20) return mapColors.roi.good;
    if (approx < 30) return mapColors.roi.medium;
    return mapColors.roi.long;
};

/**
 * Calcule la couleur d'un bâtiment selon le thème "Production d'énergie".
 *
 * @param {Object} props - Les propriétés GeoJSON du bâtiment.
 * @returns {string} Une couleur OKLCH via le module colorPalette.
 */
const getColorByProduction = (props) => {
    const prodMwh = props.PV_AN_TOT ? props.PV_AN_TOT / 1000 : 0;
    if (prodMwh > 50) return mapColors.production.huge;
    if (prodMwh > 20) return mapColors.production.large;
    if (prodMwh > 5)  return mapColors.production.medium;
    return mapColors.production.small;
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
 * @param {Object}  feature  - Un objet Feature GeoJSON.
 * @param {string}  theme    - Le thème actif ('roi' ou 'production').
 * @param {boolean} isHover  - Vrai si le curseur survole le bâtiment.
 * @returns {Object} Un objet de style compatible avec l'API Leaflet.
 */
export function getStyleForFeature(feature, theme, isHover = false) {
    const props    = feature.properties;
    const isPatrim = props.PATRIM === 1;

    const fillColor = isPatrim
        ? mapColors.patrim.fill
        : (theme === 'production' ? getColorByProduction(props) : getColorByROI(props));

    return {
        color      : isHover ? mapColors.hover.stroke : (isPatrim ? mapColors.patrim.stroke : fillColor),
        weight     : isHover ? 2 : 1,
        fillColor,
        fillOpacity: isHover ? 0.9 : 0.7,
        dashArray  : isPatrim ? '4,4' : '',
    };
}

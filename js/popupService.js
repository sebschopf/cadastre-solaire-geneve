/**
 * @module popupService
 * @description Responsabilité unique (SRP) : Construction et affichage des popups de bâtiment.
 *
 * Ce module s'occupe exclusivement de transformer les données brutes d'un bâtiment
 * en contenu HTML structuré pour l'infobulle Leaflet.
 *
 * Architecture en deux niveaux (progressive disclosure) :
 *   - Niveau 1 (toujours visible) : 3 métriques clés en langage courant.
 *   - Niveau 2 (accordéon <details>) : Détail financier complet + lien vers le lexique.
 *
 * Ce module délègue tous les calculs à metricsService (Dependency Inversion).
 *
 * @requires Leaflet (L) doit être disponible globalement.
 */

import {
    toHouseholds,
    toPanels,
    roofCoveragePercent,
    getOfficialTRI,
    breakEvenYear,
    formatCHF,
} from './metricsService.js';

// ---------------------------------------------------------------------------
// Constructeurs de blocs HTML internes (fonctions pures, non exportées)
// ---------------------------------------------------------------------------

/**
 * Construit le bloc de statut patrimonial du bâtiment.
 * @param {number} patrim - Valeur du champ PATRIM (1 = contraint).
 * @returns {string} Fragment HTML.
 */
const buildPatrimBadge = (patrim) => {
    if (patrim === 1) {
        return `<span class="popup-badge popup-badge--warning"
                      title="Zone patrimoniale : installation soumise à validation esthétique.">
                      Zone patrimoniale
                </span>`;
    }
    return `<span class="popup-badge popup-badge--ok"
                  title="Aucune contrainte patrimoniale sur ce bâtiment.">
                  Libre de contrainte
            </span>`;
};

/**
 * Construit le niveau 1 du popup : métriques compréhensibles par tous.
 * @param {Object} props - Propriétés GeoJSON du bâtiment.
 * @returns {string} Fragment HTML du niveau 1.
 */
const buildTier1 = (props) => {
    const tri = getOfficialTRI(props);
    const annee = breakEvenYear(tri);
    const foyers = toHouseholds(props.PV_AN_TOT);
    const commune = props.COMMUNE ? `<span class="popup-commune">${props.COMMUNE}</span>` : '';

    const triLabel = tri !== 'N/D'
        ? `~${tri} ans${annee ? ` <span class="popup-year">(rentable avant ${annee})</span>` : ''}`
        : 'Non déterminé';

    return `
        <div class="popup-tier1">
            <div class="popup-header">
                <h4 class="popup-title">Bilan Solaire</h4>
                ${commune}
            </div>
            <div class="popup-stats">
                <div class="popup-stat">
                    <div>
                        <strong class="popup-stat__value">~${foyers} foyer${foyers > 1 ? 's' : ''}</strong>
                        <span class="popup-stat__label">alimentés en électricité</span>
                    </div>
                </div>
                <div class="popup-stat">
                    <div>
                        <strong class="popup-stat__value">${triLabel}</strong>
                        <span class="popup-stat__label">retour sur investissement</span>
                    </div>
                </div>
            </div>
            ${buildPatrimBadge(props.PATRIM)}
        </div>
    `;
};

/**
 * Construit le niveau 2 du popup : détail financier et technique complet.
 * Encapsulé dans un élément <details> natif (accordéon accessible sans JS).
 *
 * @param {Object} props - Propriétés GeoJSON du bâtiment.
 * @returns {string} Fragment HTML du niveau 2.
 */
const buildTier2 = (props) => {
    const panels = toPanels(props.P_KWC_TOT);
    const coverage = roofCoveragePercent(props.AREA_PV_TOT, props.AREA_TOIT);
    const sub = props.SUB_AC_TOT || 0;

    const coverageLine = coverage !== null
        ? `<li><span>Surface exploitable :</span>
               <span class="popup-val">${coverage}% du toit (${Math.round(props.AREA_PV_TOT)} m²)</span></li>`
        : '';

    const subLine = sub > 0
        ? `<li><span>Subvention estimée :</span>
               <span class="popup-val" title="Subvention d'autoconsommation (G2 Solaire)">${formatCHF(sub)} CHF</span></li>`
        : '';

    return `
        <details class="popup-details">
            <summary class="popup-details__trigger">Voir le détail technique &amp; financier</summary>
            <ul class="popup-details__list">
                <li>
                    <span>Production :</span>
                    <span class="popup-val">${formatCHF(props.PV_AN_TOT)} kWh/an</span>
                </li>
                <li>
                    <span>Puissance installable :</span>
                    <span class="popup-val">${props.P_KWC_TOT ? props.P_KWC_TOT.toFixed(1) : 'N/D'} kWc
                        ${panels > 0 ? `<em>(≈ ${panels} panneaux)</em>` : ''}</span>
                </li>
                ${coverageLine}
                <li>
                    <span>CO₂ évité :</span>
                    <span class="popup-val">${formatCHF(props.CO2)} kg/an</span>
                </li>
                <li>
                    <span>Investissement estimé :</span>
                    <span class="popup-val">${formatCHF(props.INVEST_TOT)} CHF</span>
                </li>
                ${subLine}
                <li>
                    <span>Gain estimé :</span>
                    <span class="popup-val">${formatCHF(props.GAINS_AN)} CHF/an</span>
                </li>
            </ul>
            <div class="popup-source">
                <em>Calculs : <a href="https://apps.sitg-lab.ch/solaire/" target="_blank"
                    rel="noopener noreferrer">G2 Solaire</a> / SITG — données LiDAR 2019-2022.</em>
            </div>
            <a href="/lexique.html#tri" class="popup-lexique-link"
               title="Comprendre comment ces chiffres sont calculés">
               Comment ces chiffres sont-ils calculés ?
            </a>
        </details>
    `;
};

// ---------------------------------------------------------------------------
// Export public
// ---------------------------------------------------------------------------

/**
 * Construit et affiche la popup Leaflet pour un bâtiment donné.
 *
 * @param {Object}   feature - Feature GeoJSON du bâtiment.
 * @param {L.LatLng} latlng  - Position géographique d'ancrage de la popup.
 * @param {L.Map}    map     - Instance Leaflet.
 */
export function showPopup(feature, latlng, map) {
    const props = feature.properties;

    const content = `
        <div class="building-popup">
            ${buildTier1(props)}
            ${buildTier2(props)}
        </div>
    `;

    L.popup({ maxWidth: 340, className: 'solar-popup' })
        .setLatLng(latlng)
        .setContent(content)
        .openOn(map);
}

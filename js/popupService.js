/**
 * @module popupService
 * @description Responsabilité unique (SRP) : Construction et affichage des popups de bâtiment.
 *
 * Ce module s'occupe exclusivement de transformer les données brutes d'un bâtiment
 * en contenu HTML structuré pour l'infobulle Leaflet.
 *
 * Architecture en deux niveaux (progressive disclosure) :
 *   - Niveau 1 (popup visible) : 3 métriques clés en langage courant et bouton d'action.
 *   - Niveau 2 (panneau latéral) : Détail financier complet, géré par panelService.
 *
 * Ce module délègue tous les calculs à metricsService (Dependency Inversion).
 *
 * @requires Leaflet (L) doit être disponible globalement.
 */

import {
    toHouseholds,
    getOfficialTRI,
    breakEvenYear,
} from './metricsService.js';

import { icon } from './iconService.js';

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

import { openPanelWithData } from './panelService.js';

/**
 * Construit et affiche la popup Leaflet pour un bâtiment donné.
 *
 * @param {Object}   feature - Feature GeoJSON du bâtiment.
 * @param {L.LatLng} latlng  - Position géographique d'ancrage de la popup.
 * @param {L.Map}    map     - Instance Leaflet.
 */
export function showPopup(feature, latlng, map) {
    const props = feature.properties;

    const container = document.createElement('div');
    container.className = 'building-popup';
    container.innerHTML = `
        ${buildTier1(props)}
        <div class="popup-actions">
            <button class="btn-primary btn-popup" id="btn-open-dossier">
                Créer mon dossier solaire
            </button>
        </div>
    `;

    const btn = container.querySelector('#btn-open-dossier');
    if (btn) {
        btn.addEventListener('click', () => {
            openPanelWithData(props);
            map.closePopup();
        });
    }

    L.popup({ maxWidth: 340, className: 'solar-popup' })
        .setLatLng(latlng)
        .setContent(container)
        .openOn(map);
}

/**
 * @module popupService
 * @description Responsabilité unique (SRP) : Construction et affichage des popups de bâtiment.
 *
 * Ce module s'occupe exclusivement de transformer les données brutes d'un bâtiment
 * (issues de l'API SITG) en contenu HTML structuré pour l'infobulle Leaflet.
 *
 * Il ne connaît pas la carte, ne gère pas les requêtes réseau, et n'effectue
 * aucune manipulation du DOM en dehors de l'appel à l'API Leaflet.
 *
 * @requires Leaflet (L) doit être disponible globalement.
 */

// ---------------------------------------------------------------------------
// Utilitaires internes (non exportés)
// ---------------------------------------------------------------------------

/**
 * Formate un nombre selon les conventions suisses (fr-CH).
 * @param {number} num - Le nombre à formater.
 * @returns {string} Le nombre formaté (ex. 54'669).
 */
const formatCH = (num) => new Intl.NumberFormat('fr-CH').format(num);

/**
 * Génère le bloc HTML indiquant le statut patrimonial du bâtiment.
 * @param {number} patrim - La valeur du champ PATRIM (1 = contraint, autre = libre).
 * @returns {string} Un fragment HTML stylisé.
 */
const buildPatrimHtml = (patrim) => {
    if (patrim === 1) {
        return `
            <div style="color: #ef4444; font-size: 0.8rem; margin-top: 0.5rem;
                        border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">
                ⚠️ Zone sous condition patrimoniale. Soumis à validation esthétique.
            </div>`;
    }
    return `
        <div style="color: #10b981; font-size: 0.8rem; margin-top: 0.5rem;
                    border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">
            ✅ Toit libre de contrainte patrimoniale.
        </div>`;
};

// ---------------------------------------------------------------------------
// Export public
// ---------------------------------------------------------------------------

/**
 * Construit et affiche la popup Leaflet pour un bâtiment donné.
 *
 * @param {Object} feature  - Un objet Feature GeoJSON contenant les propriétés du bâtiment.
 * @param {L.LatLng} latlng - La position géographique où ancrer la popup.
 * @param {L.Map} map       - L'instance de la carte Leaflet sur laquelle ouvrir la popup.
 */
export function showPopup(feature, latlng, map) {
    const props = feature.properties;

    // --- Calculs dérivés ---
    const invest  = props.INVEST_TOT || 0;
    const gains   = props.GAINS_AN   || 0;
    const roi     = (invest > 0 && gains > 0) ? (invest / gains).toFixed(1) : 'N/A';
    // Repère : 3'000 kWh/an = consommation d'un ménage genevois moyen (hors chauffage)
    const menages = props.PV_AN_TOT  ? Math.round(props.PV_AN_TOT / 3000) : 0;

    // --- Construction du contenu HTML ---
    const popupContent = `
        <div class="building-popup">
            <h4>Bilan Solaire</h4>
            <ul>
                <li>
                    <span>Production :</span>
                    <span class="val">${formatCH(props.PV_AN_TOT)} kWh/an</span>
                </li>
                <li>
                    <span>Équiv. ménages :</span>
                    <span class="val" style="color: #10b981;">~${menages} foyer(s)</span>
                </li>
                <li>
                    <span>CO₂ évité :</span>
                    <span class="val">${formatCH(props.CO2)} kg/an</span>
                </li>
                <li>
                    <span>Investissement estimé :</span>
                    <span class="val">${formatCH(invest)} CHF</span>
                </li>
                <li>
                    <span>Gain estimé :</span>
                    <span class="val">${formatCH(gains)} CHF/an</span>
                </li>
                <li>
                    <span>Retour s/investissement :</span>
                    <span class="val" style="color: #f59e0b;">~${roi} ans</span>
                </li>
            </ul>
            ${buildPatrimHtml(props.PATRIM)}
            <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #64748b;
                        line-height: 1.4; border-top: 1px dashed #e2e8f0; padding-top: 0.5rem;">
                <em><strong>Méthode :</strong> Modélisation LiDAR de l'inclinaison,
                orientation et ombrages. Calculs G2 Solaire.</em>
            </div>
        </div>
    `;

    L.popup().setLatLng(latlng).setContent(popupContent).openOn(map);
}

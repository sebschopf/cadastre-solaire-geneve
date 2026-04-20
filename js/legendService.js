/**
 * @module legendService
 * @description Responsabilité unique (SRP) : Gestion de la légende thématique.
 *
 * Ce module centralise toute la logique d'affichage de la légende de la carte.
 * Pour ajouter un nouveau thème, il suffit d'ajouter une entrée dans l'objet
 * LEGENDS sans modifier la fonction de rendu (Open/Closed Principle).
 *
 * @requires Un élément DOM avec l'id 'themeLegend'.
 */

// ---------------------------------------------------------------------------
// Configuration des thèmes (données)
// ---------------------------------------------------------------------------

/**
 * @constant {Object} LEGENDS
 * @description Définit la configuration visuelle de chaque thème disponible.
 * Chaque thème contient :
 *   - items  {Array} : Liste des seuils {color, label}.
 *   - footer {string}: HTML optionnel affiché sous les items (ex. repère pédagogique).
 */
const LEGENDS = {
    roi: {
        items: [
            { color: '#10b981', label: 'Excellent (< 10 ans)' },
            { color: '#fcd34d', label: 'Bon (10 à 20 ans)' },
            { color: '#f59e0b', label: 'Moyen (20 à 30 ans)' },
            { color: '#ef4444', label: 'Long (> 30 ans)' },
        ],
        footer: '',
    },
    production: {
        items: [
            { color: '#047857', label: 'Énorme (> 50 MWh/an)' },
            { color: '#10b981', label: 'Grand (20 à 50 MWh/an)' },
            { color: '#6ee7b7', label: 'Moyen (5 à 20 MWh/an)' },
            { color: '#f1f5f9', label: 'Faible (< 5 MWh/an)' },
        ],
        footer: `
            <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; line-height: 1.4;
                        border-top: 1px dashed #e2e8f0; padding-top: 0.5rem;">
                💡 <em><strong>Repère :</strong> 3 MWh (soit 3'000 kWh) équivalent à la
                consommation électrique annuelle d'un ménage genevois moyen (hors chauffage).</em>
            </div>
        `,
    },
};

// ---------------------------------------------------------------------------
// Export public
// ---------------------------------------------------------------------------

/**
 * Met à jour l'affichage de la légende dans le DOM en fonction du thème actif.
 *
 * La fonction est totalement pilotée par les données (data-driven) : elle ne
 * contient aucune condition sur le nom du thème, ce qui garantit son extensibilité.
 *
 * @param {string} theme - L'identifiant du thème actif ('roi' ou 'production').
 * @param {HTMLElement} legendElement - L'élément DOM cible à mettre à jour.
 */
export function updateLegend(theme, legendElement) {
    const config = LEGENDS[theme];
    if (!config) {
        console.warn(`[legendService] Thème inconnu : "${theme}"`);
        return;
    }

    const itemsHtml = config.items
        .map(
            (item) => `
            <div class="legend-item">
                <span class="legend-color" style="background:${item.color};"></span>
                ${item.label}
            </div>
        `
        )
        .join('');

    const patrimoineHtml = `
        <div class="legend-item">
            <span class="legend-color stripe"></span>
            Soumis au Patrimoine
        </div>
    `;

    legendElement.innerHTML = itemsHtml + patrimoineHtml + config.footer;
}

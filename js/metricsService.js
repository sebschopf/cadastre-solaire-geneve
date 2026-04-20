/**
 * @module metricsService
 * @description Responsabilité unique (SRP) : Calculs de métriques et comparaisons pédagogiques.
 *
 * Ce module est une bibliothèque de fonctions PURES (sans effet de bord) destinées
 * à transformer les données brutes du SITG en valeurs compréhensibles par le grand public.
 *
 * Toutes les références de consommation sont issues de l'étude officielle SuisseÉnergie /
 * Office fédéral de l'énergie (OFEN), fiche technique "Ménage-type" — édition 08.2021.
 * Source : suisseenergie.ch
 *
 * Ce module ne connaît pas le DOM, ne fait aucune requête réseau, et n'importe rien.
 * Il peut être testé unitairement de façon isolée.
 */

// ---------------------------------------------------------------------------
// Référentiels de consommation (OFEN 2021, hors chauffage et eau chaude élec.)
// ---------------------------------------------------------------------------

/**
 * @constant {Object} HOUSEHOLD_KWH
 * @description Consommation électrique annuelle d'un ménage-type suisse.
 * Source : SuisseÉnergie / OFEN — Fiche "Ménage-type", août 2021.
 * Ces valeurs excluent : chauffage électrique, chauffe-eau électrique, pompe à chaleur.
 */
export const HOUSEHOLD_KWH = {
    apt2: 2190,  // Appartement, 2 personnes
    apt3: 2650,  // Appartement, 3 personnes (2 adultes + 1 enfant, ≈ +460 kWh)
    house4: 4048,  // Maison individuelle, 4 personnes
};

/**
 * Consommation de référence utilisée pour les comparaisons dans le popup.
 * Choix : appartement 3 personnes (famille type genevoise).
 */
const REFERENCE_KWH = HOUSEHOLD_KWH.apt3; // 2'650 kWh/an

/**
 * Puissance standard d'un panneau solaire résidentiel actuel (kWc).
 * Valeur de marché 2023-2024 pour un panneau monocristallin standard.
 */
const KWC_PER_PANEL = 0.4;

// ---------------------------------------------------------------------------
// Fonctions de comparaison pédagogique (fonctions pures, exportées)
// ---------------------------------------------------------------------------

/**
 * Convertit une production en kWh/an en nombre de foyers équivalents.
 * Utilise le ménage-type de référence (appartement 3 personnes, OFEN 2021).
 *
 * @param {number} kwhPerYear - Production annuelle en kWh.
 * @returns {number} Nombre de foyers (arrondi à l'entier inférieur, minimum 1).
 */
export function toHouseholds(kwhPerYear) {
    if (!kwhPerYear || kwhPerYear <= 0) return 0;
    return Math.max(1, Math.floor(kwhPerYear / REFERENCE_KWH));
}

/**
 * Convertit une puissance installable en kWc en nombre de panneaux standard.
 *
 * @param {number} kwc - Puissance en kilowatt-crête.
 * @returns {number} Nombre de panneaux (arrondi).
 */
export function toPanels(kwc) {
    if (!kwc || kwc <= 0) return 0;
    return Math.round(kwc / KWC_PER_PANEL);
}

/**
 * Calcule le taux de couverture solaire d'un toit (% de surface exploitable).
 *
 * @param {number} areaPv   - Surface de capteurs PV en m² (AREA_PV_TOT).
 * @param {number} areaToit - Surface totale du toit en m² (AREA_TOIT).
 * @returns {number|null} Pourcentage arrondi, ou null si données insuffisantes.
 */
export function roofCoveragePercent(areaPv, areaToit) {
    if (!areaPv || !areaToit || areaToit <= 0) return null;
    return Math.round((areaPv / areaToit) * 100);
}

/**
 * Retourne le TRI officiel (G2 Solaire) ou calcule une approximation si absent.
 *
 * Le champ TRI du SITG est calculé par le projet G2 Solaire et intègre :
 * investissement, charges annuelles, gains, subventions et tarifs locaux.
 * Il est donc plus précis que le simple ratio INVEST / GAINS.
 *
 * @param {Object} props - Les propriétés GeoJSON du bâtiment.
 * @returns {string} Le TRI en années (1 décimale) ou 'N/D'.
 */
export function getOfficialTRI(props) {
    // On préfère le TRI officiel du SITG
    if (props.TRI && props.TRI > 0 && props.TRI < 999) {
        return props.TRI.toFixed(1);
    }
    // Fallback : approximation maison (moins précise, sans charges ni subventions)
    const invest = props.INVEST_TOT || 0;
    const gains = props.GAINS_AN || 0;
    if (invest > 0 && gains > 0) {
        return (invest / gains).toFixed(1);
    }
    return 'N/D';
}

/**
 * Retourne l'année à partir de laquelle l'installation devient bénéficiaire.
 * Utile pour rendre le TRI concret : "votre toit se paie avant 2038".
 *
 * @param {string|number} tri - Le TRI en années.
 * @returns {number|null} L'année de retour, ou null si incalculable.
 */
export function breakEvenYear(tri) {
    const years = parseFloat(tri);
    if (isNaN(years) || years <= 0) return null;
    return new Date().getFullYear() + Math.ceil(years);
}

// ---------------------------------------------------------------------------
// Formatage (fonctions pures, exportées)
// ---------------------------------------------------------------------------

/**
 * Formate un nombre selon la convention suisse (apostrophe comme séparateur de milliers).
 * @param {number} num - Le nombre à formater.
 * @returns {string}
 */
export const formatCHF = (num) =>
    new Intl.NumberFormat('fr-CH').format(Math.round(num));

/**
 * @module colorPalette
 * @description Pont entre le système de couleurs OKLCH (CSS :root) et les
 * bibliothèques JavaScript (Chart.js, Leaflet) qui consomment des valeurs
 * de couleur concrètes.
 *
 * Source unique de vérité : les tokens CSS déclarés dans css/style.css (:root).
 * Ce module lit les valeurs calculées au runtime via getComputedStyle(),
 * garantissant la cohérence totale entre CSS et JS sans aucune duplication.
 *
 * Les navigateurs modernes supportent les chaînes oklch(...) en Canvas 2D
 * (support : Chrome 111+, Firefox 113+, Safari 16.4+).
 *
 * @see css/style.css — Déclaration des tokens
 */

// ---------------------------------------------------------------------------
// Lecture des tokens CSS (au chargement du module)
// ---------------------------------------------------------------------------

const getCssVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------------------------------------------------------------------------
// Palette de base (tokens sémantiques)
// ---------------------------------------------------------------------------

/**
 * @constant {Object} palette
 * @description Tokens de couleur de base, lus depuis les variables CSS.
 * Ces valeurs sont des chaînes oklch(...) natives.
 */
export const palette = {
    // --- Texte ---
    textMain   : getCssVar('--color-text-main'),
    textBody   : getCssVar('--color-text-body'),
    textMuted  : getCssVar('--color-text-muted'),

    // --- Surfaces ---
    surface       : getCssVar('--color-surface'),
    surfaceSubtle : getCssVar('--color-surface-subtle'),

    // --- Famille Patrimoine / Neutre ---
    heritageLight : getCssVar('--color-heritage-light'),
    heritageMain  : getCssVar('--color-heritage-main'),
    heritageText  : getCssVar('--color-heritage-text'),

    // --- Famille Solaire / Ambre ---
    solarLight : getCssVar('--color-solar-light'),
    solarMain  : getCssVar('--color-solar-main'),
    solarDark  : getCssVar('--color-solar-dark'),

    // --- Famille Écologie / Vert ---
    ecoLight : getCssVar('--color-eco-light'),
    ecoMain  : getCssVar('--color-eco-main'),
    ecoDark  : getCssVar('--color-eco-dark'),
};

// ---------------------------------------------------------------------------
// Couleurs sémantiques pour la carte Leaflet
// Correspondent aux seuils affichés dans legendService.js.
// ---------------------------------------------------------------------------

/**
 * @constant {Object} mapColors
 * @description Couleurs des polygones de bâtiments, par thème et par seuil.
 * Le champ 'danger' (rouge > 30 ans ROI) n'a pas de token dans :root car il
 * n'est utilisé que dans ce contexte cartographique spécifique.
 */
export const mapColors = {
    roi: {
        excellent : palette.ecoMain,                      // < 10 ans
        good      : getCssVar('--color-solar-light'),     // 10-20 ans
        medium    : palette.solarMain,                    // 20-30 ans
        long      : getCssVar('--color-solar-dark'),      // > 30 ans (orange foncé)
        unknown   : palette.heritageMain,
    },
    production: {
        huge   : palette.ecoDark,         // > 50 MWh
        large  : palette.ecoMain,         // 20-50 MWh
        medium : palette.ecoLight,        // 5-20 MWh
        small  : palette.surfaceSubtle,   // < 5 MWh
    },
    patrim: {
        fill   : palette.heritageMain,
        stroke : palette.heritageText,
    },
    hover: {
        stroke : palette.textMain,
    },
};

// ---------------------------------------------------------------------------
// Couleurs sémantiques pour Chart.js
// ---------------------------------------------------------------------------

/**
 * @constant {Object} chartColors
 * @description Couleurs utilisées dans les graphiques Chart.js.
 * Les couleurs de grille et de tooltip sont des variantes semi-transparentes
 * construites avec la syntaxe oklch(...) / alpha nativement.
 */
export const chartColors = {
    // Barres ROI (ordre : excellent → bon → moyen → long/gris)
    roi: [
        palette.ecoMain,
        palette.solarMain,
        palette.solarDark,
        palette.heritageMain,
    ],

    // Donut patrimoine (libre vs contraint)
    patrimoine: [
        palette.ecoMain,
        palette.heritageLight,
    ],

    // Barres communes
    communes: palette.textMain,

    // Tooltips et grilles
    tooltip: {
        background  : palette.surface,
        titleColor  : palette.textMain,
        bodyColor   : palette.textBody,
        borderColor : palette.heritageLight,
    },
    grid: {
        line    : getCssVar('--color-heritage-light'),
        axisTitle: palette.heritageText,
    },
};

/**
 * @module iconService
 * @description Responsabilité unique (SRP) : Gestion et rendu des icônes Lucide.
 *
 * Ce module est le point d'entrée unique pour toutes les icônes de l'application.
 * Il expose deux mécanismes :
 *
 *  1. `icon(name, opts)` — Retourne une chaîne SVG inline pour les templates JS
 *     (popupService, searchService). Les icônes héritent de `currentColor` du
 *     parent CSS — aucune couleur n'est déclarée ici en dur.
 *
 *  2. `renderAll()` — Hydrate les éléments HTML portant `data-icon="nom"`,
 *     permettant de placer les icônes en HTML sans écrire de SVG manuellement.
 *
 * L'héritage de couleur fonctionne via `color: currentColor` sur le SVG.
 * Chaque icône prend la couleur OKLCH de son élément parent — aucun token
 * n'est dupliqué ici.
 *
 * @see https://lucide.dev/icons/
 */

import {
    Sun, Search, ZoomIn, Calendar, BarChart2, Zap,
    RefreshCw, Coins, Landmark, Plane, BookOpen,
    Home, CheckCircle2, AlertTriangle, Lightbulb,
    MapPin, ChevronDown, ArrowLeft, Info, FileText,
    Leaf, TrendingDown, Euro, Ruler, CloudOff,
} from '/node_modules/lucide/dist/esm/lucide.js';

// ---------------------------------------------------------------------------
// Registre d'icônes — une seule déclaration par icône utilisée dans l'app.
// Pour ajouter une icône : 1) importer depuis lucide, 2) l'enregistrer ici.
// ---------------------------------------------------------------------------

const ICONS = {
    // Navigation & UI
    'arrow-left'    : ArrowLeft,
    'chevron-down'  : ChevronDown,
    'info'          : Info,
    'file-text'     : FileText,
    'search'        : Search,
    'zoom-in'       : ZoomIn,

    // Domaine solaire
    'sun'           : Sun,
    'zap'           : Zap,
    'leaf'          : Leaf,
    'bar-chart-2'   : BarChart2,
    'trending-down' : TrendingDown,

    // Bâtiment & popup
    'home'          : Home,
    'calendar'      : Calendar,
    'ruler'         : Ruler,
    'map-pin'       : MapPin,
    'landmark'      : Landmark,
    'check-circle-2': CheckCircle2,
    'alert-triangle': AlertTriangle,

    // Lexique
    'lightbulb'     : Lightbulb,
    'book-open'     : BookOpen,
    'refresh-cw'    : RefreshCw,
    'plane'         : Plane,
    'coins'         : Coins,
    'euro'          : Euro,
    'cloud-off'     : CloudOff,
};

// ---------------------------------------------------------------------------
// Fonction utilitaire interne : génère le tableau d'attributs SVG
// ---------------------------------------------------------------------------

/**
 * Construit les attributs SVG à partir du tableau Lucide [tag, attrs, children].
 * @param {Array} node - Nœud Lucide [tagName, attributes, children?]
 * @returns {string} Chaîne d'attributs HTML.
 */
const attrsToString = (attrs) =>
    Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');

/**
 * Sérialise récursivement un nœud Lucide en chaîne SVG.
 * @param {Array} node
 * @returns {string}
 */
const nodeToSVG = ([tag, attrs, children = []]) =>
    `<${tag} ${attrsToString(attrs)}>${children.map(nodeToSVG).join('')}</${tag}>`;

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Retourne une chaîne SVG inline pour une icône Lucide.
 * L'icône hérite automatiquement de `currentColor` (couleur CSS du parent).
 *
 * @param {string} name               - Nom de l'icône (ex: 'sun', 'calendar').
 * @param {Object} [opts={}]          - Options optionnelles.
 * @param {number} [opts.size=18]     - Taille en pixels.
 * @param {string} [opts.className='']- Classes CSS supplémentaires.
 * @param {string} [opts.label='']    - aria-label (si icône non purement décorative).
 * @returns {string} Fragment SVG prêt à être injecté en innerHTML.
 */
export function icon(name, { size = 18, className = '', label = '' } = {}) {
    const iconDef = ICONS[name];
    if (!iconDef) {
        console.warn(`[iconService] Icône inconnue : "${name}"`);
        return '';
    }

    // Lucide retourne [tag, attrs, children[]]. On sérialise en SVG.
    // On surcharge les attrs SVG racine pour contrôle taille et accessibilité.
    const [tag, baseAttrs, children] = iconDef;

    const svgAttrs = {
        ...baseAttrs,
        width               : size,
        height              : size,
        class               : `lucide-icon ${className}`.trim(),
        'aria-hidden'       : label ? 'false' : 'true',
        ...(label ? { 'aria-label': label, role: 'img' } : {}),
        focusable           : 'false', // Empêche le focus sur IE11
    };

    return `<svg ${attrsToString(svgAttrs)}>${children.map(nodeToSVG).join('')}</svg>`;
}

/**
 * Hydrate tous les éléments portant l'attribut `data-icon="nom"` dans le DOM.
 * À appeler après que le DOM est prêt.
 *
 * Usage HTML : <span data-icon="sun" data-icon-size="20"></span>
 *
 * @param {Element} [root=document] - Racine de la recherche (utile pour les popups).
 */
export function renderAll(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
        const name  = el.dataset.icon;
        const size  = parseInt(el.dataset.iconSize || '18', 10);
        const label = el.dataset.iconLabel || '';
        el.innerHTML = icon(name, { size, label });
        el.classList.add('icon-host');
    });
}

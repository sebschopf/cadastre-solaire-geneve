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

// ---------------------------------------------------------------------------
// Accès au bundle Lucide (chargé via <script> dans le HTML)
// ---------------------------------------------------------------------------

const lucideIcons = window.lucide ? window.lucide.icons : {};

if (!window.lucide) {
    console.error("[iconService] Le bundle Lucide n'est pas chargé. Vérifiez l'inclusion de lucide.min.js.");
}

// ---------------------------------------------------------------------------
// Registre d'icônes — une seule déclaration par icône utilisée dans l'app.
// ---------------------------------------------------------------------------

const ICONS = {
    // Navigation & UI
    'arrow-left'    : lucideIcons.ArrowLeft,
    'chevron-down'  : lucideIcons.ChevronDown,
    'info'          : lucideIcons.Info,
    'file-text'     : lucideIcons.FileText,
    'search'        : lucideIcons.Search,
    'zoom-in'       : lucideIcons.ZoomIn,

    // Domaine solaire
    'sun'           : lucideIcons.Sun,
    'zap'           : lucideIcons.Zap,
    'leaf'          : lucideIcons.Leaf,
    'bar-chart-2'   : lucideIcons.BarChart2,
    'trending-down' : lucideIcons.TrendingDown,

    // Bâtiment & popup
    'home'          : lucideIcons.Home,
    'calendar'      : lucideIcons.Calendar,
    'ruler'         : lucideIcons.Ruler,
    'map-pin'       : lucideIcons.MapPin,
    'landmark'      : lucideIcons.Landmark,
    'check-circle-2': lucideIcons.CheckCircle2,
    'alert-triangle': lucideIcons.AlertTriangle,

    // Lexique
    'refresh-cw'    : lucideIcons.RefreshCw,
    'coins'         : lucideIcons.Coins,
    'plane'         : lucideIcons.Plane,
    'book-open'     : lucideIcons.BookOpen,
    'lightbulb'     : lucideIcons.Lightbulb,
    'euro'          : lucideIcons.Euro,
    'cloud-off'     : lucideIcons.CloudOff,
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

    // Dans la version ESM de Lucide, iconDef est directement un tableau de nœuds enfants :
    // [ [tag, attrs], [tag, attrs], ... ]
    const children = iconDef;

    // Attributs standards Lucide pour le conteneur <svg>
    const svgAttrs = {
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: `lucide-icon ${className}`.trim(),
        'aria-hidden': label ? 'false' : 'true',
        ...(label ? { 'aria-label': label, role: 'img' } : {}),
        focusable: 'false',
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

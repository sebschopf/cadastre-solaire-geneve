/**
 * @module printService
 * @description Service dédié exclusivement à la pagination et impression.
 *
 * Principe:
 * 1. Aucun hack CSS, aucun @page counter-increment
 * 2. Dimensions A4 connues avant impression → pagination explicite en JS
 * 3. Header et footer construits proprement en DOM (pas innerHTML)
 * 4. Les styles visuels sont dans print.css (.print-page, .page-content, etc.)
 * 5. Ce service ne gère que la LOGIQUE, pas les styles
 *
 * Références normatives:
 * - CSS Paged Media Level 3    : https://www.w3.org/TR/css-page-3/
 * - CSS Fragmentation Level 4  : https://www.w3.org/TR/css-break-4/
 * - CSS Generated Content      : https://www.w3.org/TR/CSS21/generate.html
 */

// ─────────────────────────────────────────────
// CONSTANTES A4 (96 DPI = norme CSS navigateur)
// Référence: CSS Paged Media Level 3 §7.1
// ─────────────────────────────────────────────
// 1mm = 96/25.4 = 3.7795 CSS pixels
// A4 total      : 297mm = 1122 px
// Padding page  : 20mm haut + 20mm bas = 40mm = 151 px
// Zone contenu  : 297mm - 40mm = 257mm = 971 px
//
// Largeur contenu imprimé:
// A4 width    : 210mm = 794 px
// padding L/R : 20mm + 10mm = 30mm = 113 px
// Contenu     : 210 - 30 = 180mm = 680 px
const A4 = Object.freeze({
    CONTENT_HEIGHT_PX: 971,  // 257mm × 3.7795 — hauteur mesurable en JS
    CONTENT_WIDTH_PX:  680,  // 180mm × 3.7795 — largeur du contenu imprimé
    SAFETY_MARGIN_PX:  30,   // marge de sécurité anti-débordement (px)
});

// ─────────────────────────────────────────────
// ÉTAT PRIVÉ DU MODULE
// ─────────────────────────────────────────────
const state = {
    isPrinting: false,
};

// ─────────────────────────────────────────────
// POINT D'ENTRÉE PUBLIC
// ─────────────────────────────────────────────

/**
 * Attache le listener d'impression sur le bouton.
 * Peut être appelé plusieurs fois sans créer de doublons.
 */
export function setupPrintButton() {
    const printBtn = document.getElementById('sidePanelPrintBtn');
    if (!printBtn) return;

    printBtn.removeEventListener('click', generatePrintDocument);
    printBtn.addEventListener('click', generatePrintDocument);
}

// ─────────────────────────────────────────────
// ORCHESTRATEUR PRINCIPAL
// ─────────────────────────────────────────────

/**
 * Génère un document paginé prêt à imprimer.
 * Lit d'abord les données dynamiques du DOM, puis nettoie et reconstruit.
 */
async function generatePrintDocument() {
    if (state.isPrinting) return;
    state.isPrinting = true;

    const bodyEl = document.getElementById('sidePanelBody');
    if (!bodyEl) {
        state.isPrinting = false;
        return;
    }

    const originalContent = bodyEl.innerHTML;

    // Lire les données AVANT de vider le DOM
    const headerData = readHeaderData();

    try {
        // Mesurer les hauteurs AVANT de vider le DOM.
        // Après bodyEl.innerHTML='', les éléments sont détachés et offsetHeight=0.
        const elements = Array.from(bodyEl.children);
        const heights  = measureAllHeights(elements);

        bodyEl.innerHTML = '';

        paginateContent(bodyEl, elements, heights, headerData);
        finalizePages(bodyEl);

        await waitForRender();

        window.print();

    } finally {
        restoreContent(bodyEl, originalContent);
    }
}

// ─────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────

/**
 * Découpe les éléments en pages A4 et les injecte dans bodyEl.
 *
 * Règles de pagination (inspirées CSS Fragmentation Level 4 §3):
 * - Un élément qui ne tient pas sur la page courante → nouvelle page
 * - Un élément plus grand que la page entière → forcé en début de page (évite
 *   qu'il soit coupé par le mécanisme de saut; le CSS break-inside gère le reste)
 * - On ne coupe JAMAIS un élément entre deux pages
 *
 * @param {HTMLElement} bodyEl
 * @param {Element[]}   elements
 * @param {number[]}    heights   — hauteurs pré-mesurées (DOM intact)
 * @param {HeaderData}  headerData
 */
function paginateContent(bodyEl, elements, heights, headerData) {
    const maxContent = A4.CONTENT_HEIGHT_PX - A4.SAFETY_MARGIN_PX;

    let currentPage   = createPage(1, headerData);
    let currentHeight = 0;
    let pageCounter   = 1;

    elements.forEach((el, i) => {
        const elHeight = heights[i];

        // Cas 1: l'élément ne tient pas dans l'espace restant → nouvelle page
        // Cas 2: l'élément est plus grand qu'une page entière → aussi nouvelle page
        //        (au moins il commence au début d'une page propre)
        const doesNotFit    = currentHeight + elHeight > maxContent;
        const isOversized   = elHeight > maxContent;
        const pageHasContent = currentHeight > 0;

        if (pageHasContent && (doesNotFit || isOversized)) {
            bodyEl.appendChild(currentPage);
            pageCounter++;
            currentPage   = createPage(pageCounter, headerData);
            currentHeight = 0;
        }

        currentPage.querySelector('.page-content').appendChild(el);
        currentHeight += elHeight;
    });

    bodyEl.appendChild(currentPage);
}

/**
 * Finalise toutes les pages après pagination:
 * 1. Renumérote les footers avec le total réel
 * 2. Supprime le saut de page forcé sur la dernière (évite page vide finale)
 * @param {HTMLElement} bodyEl
 */
function finalizePages(bodyEl) {
    const allPages   = bodyEl.querySelectorAll('.print-page');
    const totalPages = allPages.length;

    allPages.forEach((page, index) => {
        // Numérotation correcte
        const footerRight = page.querySelector('.print-fixed-footer .pf-right');
        if (footerRight) {
            footerRight.textContent = `Page ${index + 1} / ${totalPages}`;
        }

        // Dernière page : pas de saut forcé (évite la page blanche finale)
        if (index === totalPages - 1) {
            page.style.breakAfter    = 'auto';
            page.style.pageBreakAfter = 'auto';
        }
    });
}

// ─────────────────────────────────────────────
// CONSTRUCTION D'UNE PAGE
// ─────────────────────────────────────────────

/**
 * @typedef {{ address: string, date: string }} HeaderData
 */

/**
 * Crée une page complète (header + contenu + footer).
 * Les styles visuels sont dans print.css (.print-page, .print-fixed-header, etc.)
 * @param {number}     pageNumber
 * @param {HeaderData} headerData
 * @returns {HTMLDivElement}
 */
function createPage(pageNumber, headerData) {
    const page = document.createElement('div');
    page.className = 'print-page';

    page.appendChild(createHeader(headerData));
    page.appendChild(createContent());
    page.appendChild(createFooter(pageNumber));

    return page;
}

/**
 * Crée le header avec les données dynamiques déjà lues.
 * @param {HeaderData} headerData
 * @returns {HTMLDivElement}
 */
function createHeader(headerData) {
    const header = document.createElement('div');
    header.className = 'print-fixed-header';

    const left   = document.createElement('span');
    const center = document.createElement('span');
    const right  = document.createElement('span');

    left.className   = 'ph-col ph-left';
    center.className = 'ph-col ph-center';
    right.className  = 'ph-col ph-right';

    left.textContent   = headerData.address;
    center.textContent = headerData.date;
    right.textContent  = 'Rapport de Potentiel Solaire';

    header.appendChild(left);
    header.appendChild(center);
    header.appendChild(right);

    return header;
}

/**
 * Crée la zone de contenu vide.
 * Les styles sont dans print.css (.page-content)
 * @returns {HTMLDivElement}
 */
function createContent() {
    const content = document.createElement('div');
    content.className = 'page-content';
    return content;
}

/**
 * Crée le footer avec le numéro de page provisoire.
 * La numérotation finale est corrigée par finalizePages().
 * @param {number} pageNumber
 * @returns {HTMLDivElement}
 */
function createFooter(pageNumber) {
    const footer = document.createElement('div');
    footer.className = 'print-fixed-footer';

    const left   = document.createElement('span');
    const center = document.createElement('span');
    const right  = document.createElement('span');

    left.className   = 'pf-col pf-left';
    center.className = 'pf-col pf-center';
    right.className  = 'pf-col pf-right';

    left.textContent   = 'cadastre-solaire-geneve.ch';
    center.textContent = 'Propulsé avec bienveillance par Solar by Sébastien Schopfer';
    right.textContent  = `Page ${pageNumber}`;  // Provisoire → corrigé par finalizePages()

    footer.appendChild(left);
    footer.appendChild(center);
    footer.appendChild(right);

    return footer;
}

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

/**
 * Lit les données dynamiques du header dans le DOM AVANT nettoyage.
 * Ces IDs existent dans index.html (hors sidePanelBody).
 * @returns {HeaderData}
 */
function readHeaderData() {
    return {
        address: document.getElementById('printHeaderAddress')?.textContent ?? '',
        date:    document.getElementById('printHeaderDate')?.textContent    ?? '',
    };
}

/**
 * Mesure la hauteur réelle d'un élément (en px).
 * DOIT être appelé tant que l'élément est dans le DOM.
 * @param {Element} el
 * @returns {number}
 */
function measureHeight(el) {
    return el.offsetHeight || el.getBoundingClientRect().height || 0;
}

/**
 * Pré-mesure les hauteurs de tous les éléments dans un container simulant
 * la largeur et le style de la zone imprimée (180mm = 680px, font 10pt).
 *
 * Pourquoi: print.css est media="print" → non appliqué lors de la mesure JS.
 * Le panel écran peut être plus étroit (ex: 400px) → les textes s'étalent
 * sur plus de lignes → hauteurs mesurées trop grandes → sauts de page injustifiés.
 *
 * Solution: cloner dans un container avec les dimensions d'impression exactes.
 *
 * @param {Element[]} elements
 * @returns {number[]}
 */
function measureAllHeights(elements) {
    // Container caché aux dimensions de la zone de contenu imprimée
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        `width:${A4.CONTENT_WIDTH_PX}px`,
        'visibility:hidden',
        'pointer-events:none',
        'font-size:10pt',        // base font print (print.css: body { font-size: 10pt })
        'line-height:1.5',       // print.css: body { line-height: 1.5 }
        'font-family:inherit',
        'box-sizing:border-box',
        'overflow:visible',
    ].join(';');
    document.body.appendChild(probe);

    const heights = elements.map(el => {
        const clone = el.cloneNode(true);
        probe.appendChild(clone);
        const h = clone.getBoundingClientRect().height;
        probe.removeChild(clone);
        return h;
    });

    document.body.removeChild(probe);
    return heights;
}

/**
 * Attend la fin du rendu navigateur avant impression.
 * Deux frames: un pour le layout, un pour le paint.
 * @returns {Promise<void>}
 */
function waitForRender() {
    return new Promise(resolve =>
        requestAnimationFrame(() =>
            requestAnimationFrame(() =>
                setTimeout(resolve, 100)
            )
        )
    );
}

/**
 * Restaure le contenu original après impression.
 * Le drapeau `restored` protège contre la double exécution
 * (afterprint + timeout peuvent s'exécuter tous les deux).
 * @param {HTMLElement} bodyEl
 * @param {string}      originalContent
 */
function restoreContent(bodyEl, originalContent) {
    let restored = false;

    const restore = () => {
        if (restored) return;
        restored = true;
        bodyEl.innerHTML = originalContent;
        state.isPrinting = false;
    };

    window.addEventListener('afterprint', restore, { once: true });
    setTimeout(restore, 10000);
}

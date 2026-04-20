/**
 * @module searchService
 * @description Responsabilité unique (SRP) : Gestion de la recherche d'adresse.
 *
 * Ce module encapsule toute la logique de recherche par adresse dans la base
 * de données OCEN du SITG. Il prend en charge :
 *   - La normalisation de la requête (accents, casse, mots-clés numériques).
 *   - La construction de la clause WHERE SQL pour l'API ArcGIS.
 *   - L'affichage des résultats dans la liste déroulante.
 *   - La sélection d'un bâtiment (zoom + popup).
 *
 * Ce module ne connaît pas le thème actif, ni la logique de colorisation. Il
 * délègue l'affichage du popup à popupService (Dependency Inversion).
 *
 * @requires Leaflet (L) doit être disponible globalement.
 */

import { showPopup } from './popupService.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** URL de base de l'API FeatureServer du SITG pour les bâtiments PV. */
const SITG_BASE_URL =
    'https://vector.sitg.ge.ch/arcgis/rest/services/OCEN_SOLAIRE_PV_BATIMENT/FeatureServer/0/query';

/**
 * Préfixe le proxy Vercel sur une URL SITG pour résoudre le CORS en production.
 * La réponse bénéficiera du cache CDN Vercel (24h) défini dans api/proxy.js.
 *
 * @param {string} sitgUrl - L'URL SITG à proxyfier.
 * @returns {string} L'URL passant par le proxy.
 */
const withProxy = (sitgUrl) => `/api/proxy?url=${encodeURIComponent(sitgUrl)}`;

/** Nombre maximum de résultats retournés par la recherche. */
const MAX_RESULTS = 15;

/** Nombre minimum de caractères avant de déclencher la recherche. */
const MIN_QUERY_LENGTH = 3;

/** Délai de debounce (ms) avant l'envoi de la requête de recherche. */
const SEARCH_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Utilitaires internes (non exportés)
// ---------------------------------------------------------------------------

/**
 * Normalise une chaîne de caractères pour la recherche LIKE SQL.
 * Remplace les caractères accentués par '_' (wildcard SQL) pour garantir
 * des résultats même en cas de variante orthographique dans la base de données.
 *
 * @param {string} query - La chaîne saisie par l'utilisateur.
 * @returns {string} La chaîne normalisée en majuscules avec wildcards.
 */
const normalizeQuery = (query) =>
    query
        .toUpperCase()
        .replace(/[EÉÈÊË]/g, '_')
        .replace(/[AÀÂÄ]/g, '_')
        .replace(/[IÎÏ]/g, '_')
        .replace(/[OÔÖ]/g, '_')
        .replace(/[UÙÛÜ]/g, '_')
        .replace(/[CÇ]/g, '_');

/**
 * Construit la clause WHERE SQL à partir des mots-clés de la requête.
 *
 * Les mots purement numériques (numéros de rue) sont recherchés en position
 * de numéro (ex. "12 " ou " 12 ") plutôt qu'en sous-chaîne, pour éviter
 * les faux positifs.
 *
 * @param {string} normalizedQuery - La requête normalisée.
 * @returns {string|null} Une clause WHERE SQL, ou null si aucun mot valide.
 */
const buildWhereClause = (normalizedQuery) => {
    const words = normalizedQuery
        .split(/[\s\-'']+/)
        .filter((w) => w.length > 2 || (!isNaN(w) && w.length > 0));

    if (words.length === 0) return null;

    return words
        .map((w) => {
            if (!isNaN(w)) {
                // Numéro de rue : on cherche en position de numéro de voirie
                return `(UPPER(ADRESSE) LIKE '${w} %' OR UPPER(ADRESSE) LIKE '% ${w} %' OR UPPER(ADRESSE) LIKE '% ${w}-%')`;
            }
            return `UPPER(ADRESSE) LIKE '%${w}%'`;
        })
        .join(' AND ');
};

// ---------------------------------------------------------------------------
// Export public
// ---------------------------------------------------------------------------

/**
 * Initialise le service de recherche en attachant les écouteurs d'événements.
 *
 * @param {Object} config - La configuration du service.
 * @param {HTMLInputElement} config.searchInput      - Le champ de saisie de l'adresse.
 * @param {HTMLElement}      config.resultsContainer - Le conteneur de la liste de résultats.
 * @param {L.Map}            config.map              - L'instance Leaflet de la carte.
 * @param {Map}              config.cachedFeatures  - Le cache partagé OBJECTID -> Feature de map.js.
 *                                                     Permet d'éviter le re-téléchargement du bâtiment
 *                                                     sélectionné lors du moveend consécutif au zoom.
 */
export function initSearch({ searchInput, resultsContainer, map, cachedFeatures }) {
    let debounceTimer;
    let searchAbortController = null; // AbortController dédié à la recherche
    let currentLayer = null;          // Calque du bâtiment sélectionné (surbrillance)

    // --- Fermeture des résultats sur clic extérieur ---
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });

    // --- Déclenchement de la recherche avec debounce ---
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < MIN_QUERY_LENGTH) {
            resultsContainer.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => _search(query), SEARCH_DEBOUNCE_MS);
    });

    // -------------------------------------------------------------------------
    // Fonctions internes (accès au scope de la closure)
    // -------------------------------------------------------------------------

    /**
     * Exécute la requête de recherche et met à jour la liste de résultats.
     * @param {string} query - La requête brute saisie par l'utilisateur.
     */
    async function _search(query) {
        const whereClause = buildWhereClause(normalizeQuery(query));
        if (!whereClause) return;

        // Annuler la recherche précédente si elle est encore en vol
        if (searchAbortController) searchAbortController.abort();
        searchAbortController = new AbortController();
        const { signal } = searchAbortController;

        const sitgUrl = `${SITG_BASE_URL}?where=${encodeURIComponent(whereClause)}&outFields=OBJECTID,ADRESSE,PV_AN_TOT,CO2,INVEST_TOT,GAINS_AN,PATRIM&outSR=4326&f=geojson&resultRecordCount=${MAX_RESULTS}`;
        const url = withProxy(sitgUrl);

        try {
            const response = await fetch(url, { signal });
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                _renderResults(data.features);
            } else {
                resultsContainer.innerHTML =
                    '<div style="padding: 1rem; color: #64748b;">Aucun bâtiment trouvé.</div>';
                resultsContainer.style.display = 'block';
            }
        } catch (error) {
            if (error.name === 'AbortError') return; // Annulation intentionnelle
            console.error('[searchService] Erreur lors de la recherche :', error);
        }
    }

    /**
     * Affiche les résultats de recherche dans la liste déroulante.
     * @param {Array} features - Les features GeoJSON retournées par l'API.
     */
    function _renderResults(features) {
        resultsContainer.innerHTML = '';
        features.forEach((feature) => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 0.75rem 1.5rem; cursor: pointer; border-bottom: 1px solid #f1f5f9;';
            div.innerText = feature.properties.ADRESSE || 'Adresse inconnue';

            div.addEventListener('mouseover', () => (div.style.backgroundColor = '#f8fafc'));
            div.addEventListener('mouseout',  () => (div.style.backgroundColor = 'transparent'));
            div.addEventListener('click',     () => {
                _selectBuilding(feature);
                resultsContainer.style.display = 'none';
                searchInput.value = feature.properties.ADRESSE;
            });

            resultsContainer.appendChild(div);
        });
        resultsContainer.style.display = 'block';
    }

    /**
     * Sélectionne un bâtiment : surligne le polygone, centre la carte et ouvre la popup.
     * @param {Object} feature - La feature GeoJSON du bâtiment sélectionné.
     */
    function _selectBuilding(feature) {
        if (currentLayer) map.removeLayer(currentLayer);

        // Pré-enregistrer dans le cache partagé pour éviter un double fetch
        // lors du 'moveend' déclenché par le fitBounds ci-dessous.
        if (cachedFeatures && !cachedFeatures.has(feature.properties.OBJECTID)) {
            cachedFeatures.set(feature.properties.OBJECTID, feature);
        }

        currentLayer = L.geoJSON(feature, {
            style: { color: '#0f172a', weight: 4, fillColor: '#fcd34d', fillOpacity: 0.8 },
        }).addTo(map);

        const bounds = currentLayer.getBounds();
        map.fitBounds(bounds, { maxZoom: 18, padding: [50, 50] });

        showPopup(feature, bounds.getCenter(), map);
    }
}

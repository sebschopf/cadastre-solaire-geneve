/**
 * @module map
 * @description Orchestrateur de la carte interactive (SRP).
 *
 * Ce module est le point d'entrée unique pour l'initialisation de la carte.
 * Sa SEULE responsabilité est d'instancier la carte Leaflet et de coordonner
 * les services spécialisés :
 *
 *   - apiService    : Chargement des bâtiments depuis l'API du SITG.
 *   - styleService  : Calcul du style visuel des polygones.
 *   - popupService  : Construction et affichage des info-bulles.
 *   - legendService : Mise à jour de la légende thématique.
 *   - searchService : Gestion de la recherche par adresse.
 *
 * Il ne contient aucune logique métier propre. Toute modification fonctionnelle
 * doit être effectuée dans le service concerné.
 *
 * @requires Leaflet (L) doit être disponible globalement via le <script> de index.html.
 */

import { fetchBuildings } from './apiService.js';
import { getStyleForFeature } from './styleService.js';
import { showPopup } from './popupService.js';
import { updateLegend } from './legendService.js';
import { initSearch } from './searchService.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Coordonnées du centre initial de la carte (Genève). */
const MAP_CENTER = [46.2044, 6.1432];

/** Niveau de zoom initial. */
const MAP_ZOOM_INITIAL = 13;

/**
 * Niveau de zoom minimum pour déclencher le chargement des bâtiments.
 * En dessous de ce seuil, une requête retournerait trop de résultats.
 */
const MAP_ZOOM_THRESHOLD = 16;

/** Délai de debounce (ms) sur l'événement 'moveend' de la carte. */
const MAP_MOVE_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Initialisation (export public)
// ---------------------------------------------------------------------------

/**
 * Initialise la carte Leaflet et tous ses services associés.
 * Doit être appelée une seule fois au chargement de la page (depuis app.js).
 */
export function initMap() {

    // --- Carte Leaflet ---
    const map = L.map('map').setView(MAP_CENTER, MAP_ZOOM_INITIAL);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
    }).addTo(map);

    // --- Éléments DOM ---
    const themeSelect = document.getElementById('themeSelect');
    const legendElement = document.getElementById('themeLegend');
    const zoomWarning = document.getElementById('zoomWarning');
    const searchInput = document.getElementById('addressSearch');
    const resultsContainer = document.getElementById('searchResults');

    // --- État interne ---
    let currentTheme = 'roi'; // Thème actif : 'roi' | 'production'
    const cachedFeatures = new Map(); // Cache local : OBJECTID -> Feature GeoJSON
    const thematicLayerGroup = L.layerGroup().addTo(map); // Groupe de calques des bâtiments

    // --- Initialisation des services ---
    updateLegend(currentTheme, legendElement);

    initSearch({ searchInput, resultsContainer, map, cachedFeatures });

    // -------------------------------------------------------------------------
    // Rendu des bâtiments
    // -------------------------------------------------------------------------

    /**
     * Ajoute sur la carte les bâtiments nouvellement reçus de l'API.
     *
     * Utilise un cache (cachedFeatures) pour ne jamais re-dessiner un bâtiment
     * déjà affiché, même si les requêtes BBOX se chevauchent partiellement.
     *
     * Crée un seul calque L.geoJSON par lot de bâtiments pour de meilleures
     * performances Leaflet (un seul objet DOM par lot, non pas un par bâtiment).
     *
     * @param {Array} features - Les features GeoJSON à ajouter.
     */
    function renderBuildings(features) {
        const newFeatures = features.filter(
            (f) => !cachedFeatures.has(f.properties.OBJECTID)
        );
        if (newFeatures.length === 0) return;

        // Mise en cache pour éviter les doublons
        newFeatures.forEach((f) => cachedFeatures.set(f.properties.OBJECTID, f));

        const geoJsonLayer = L.geoJSON(newFeatures, {
            style: (feature) => getStyleForFeature(feature, currentTheme, false),
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => {
                        e.target.setStyle(getStyleForFeature(feature, currentTheme, true));
                        e.target.bringToFront();
                    },
                    mouseout: (e) => {
                        geoJsonLayer.resetStyle(e.target);
                    },
                    click: (e) => {
                        showPopup(feature, e.latlng, map);
                    },
                });
            },
        });

        thematicLayerGroup.addLayer(geoJsonLayer);
    }

    /**
     * Rafraîchit le style de tous les bâtiments affichés.
     * Appelée lors du changement de thème pour recolorer la carte sans recharger les données.
     */
    function refreshAllStyles() {
        thematicLayerGroup.eachLayer((layer) => {
            if (layer.setStyle) {
                layer.setStyle((feature) => getStyleForFeature(feature, currentTheme, false));
            }
        });
    }

    // -------------------------------------------------------------------------
    // Chargement des données spatiales
    // -------------------------------------------------------------------------

    /**
     * Charge les bâtiments visibles dans la fenêtre courante de la carte.
     *
     * Se déclenche uniquement au-dessus du seuil de zoom défini par MAP_ZOOM_THRESHOLD.
     * Délègue entièrement la requête réseau à apiService (SRP).
     */
    async function loadBuildingsInView() {
        const zoom = map.getZoom();

        if (zoom < MAP_ZOOM_THRESHOLD) {
            zoomWarning.classList.remove('hidden');
            return;
        }
        zoomWarning.classList.add('hidden');

        const features = await fetchBuildings(map.getBounds());

        // fetchBuildings retourne null si la requête a été annulée (AbortController)
        if (features && features.length > 0) {
            renderBuildings(features);
        }
    }

    // -------------------------------------------------------------------------
    // Événements
    // -------------------------------------------------------------------------

    // Debounce sur le déplacement de carte pour ne pas mitrailler le SITG
    let mapMoveTimer;
    map.on('moveend', () => {
        clearTimeout(mapMoveTimer);
        mapMoveTimer = setTimeout(loadBuildingsInView, MAP_MOVE_DEBOUNCE_MS);
    });

    // Changement de thème : mise à jour de la légende et recolorisation
    themeSelect.addEventListener('change', (e) => {
        currentTheme = e.target.value;
        updateLegend(currentTheme, legendElement);
        refreshAllStyles();
    });

    // Chargement initial au démarrage
    loadBuildingsInView();
}

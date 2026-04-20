import { fetchBuildings } from './apiService.js';

export function initMap() {
    const map = L.map('map').setView([46.2044, 6.1432], 13); // Centré sur Genève

    // Fond de carte clair et lisible
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    let currentLayer = null; // Pour le bâtiment recherché
    let thematicLayerGroup = L.layerGroup().addTo(map); // Pour les bâtiments dynamiques
    let cachedFeatures = new Map(); // OBJECTID -> Feature
    let currentTheme = 'roi'; // 'roi' ou 'production'

    const searchInput = document.getElementById('addressSearch');
    const resultsContainer = document.getElementById('searchResults');
    const themeSelect = document.getElementById('themeSelect');
    const themeLegend = document.getElementById('themeLegend');
    const zoomWarning = document.getElementById('zoomWarning');
    let debounceTimer;

    // --- MISE À JOUR DE LA LÉGENDE ---
    // --- CONFIGURATION DES LÉGENDES ---
    const LEGENDS = {
        roi: {
            items: [
                { color: '#10b981', label: 'Excellent (< 10 ans)' },
                { color: '#fcd34d', label: 'Bon (10 à 20 ans)' },
                { color: '#f59e0b', label: 'Moyen (20 à 30 ans)' },
                { color: '#ef4444', label: 'Long (> 30 ans)' }
            ],
            footer: ''
        },
        production: {
            items: [
                { color: '#047857', label: 'Énorme (> 50 MWh/an)' },
                { color: '#10b981', label: 'Grand (20 à 50 MWh/an)' },
                { color: '#6ee7b7', label: 'Moyen (5 à 20 MWh/an)' },
                { color: '#f1f5f9', label: 'Faible (< 5 MWh/an)' }
            ],
            footer: `
                <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; line-height: 1.4; border-top: 1px dashed #e2e8f0; padding-top: 0.5rem;">
                    💡 <em><strong>Repère :</strong> 3 MWh (soit 3'000 kWh) équivalent à la consommation électrique annuelle d'un ménage genevois moyen (hors chauffage).</em>
                </div>
            `
        }
    };

    function updateLegend() {
        const config = LEGENDS[currentTheme];
        
        const itemsHtml = config.items.map(item => `
            <div class="legend-item">
                <span class="legend-color" style="background:${item.color};"></span> 
                ${item.label}
            </div>
        `).join('');

        const patrimoineHtml = `<div class="legend-item"><span class="legend-color stripe"></span> Soumis au Patrimoine</div>`;

        themeLegend.innerHTML = itemsHtml + patrimoineHtml + config.footer;
    }

    // --- COULEURS THÉMATIQUES ---
    function getStyleForFeature(feature, isHover = false) {
        const props = feature.properties;
        let fillColor = '#cbd5e1';
        let isStripe = props.PATRIM === 1;

        if (!isStripe) {
            if (currentTheme === 'roi') {
                const invest = props.INVEST_TOT || 0;
                const gains = props.GAINS_AN || 0;
                let roi = 999;
                if (invest > 0 && gains > 0) roi = invest / gains;

                if (roi < 10) fillColor = '#10b981'; // Vert
                else if (roi < 20) fillColor = '#fcd34d'; // Jaune
                else if (roi < 30) fillColor = '#f59e0b'; // Orange
                else fillColor = '#ef4444'; // Rouge
            } else {
                const prod = props.PV_AN_TOT ? props.PV_AN_TOT / 1000 : 0; // MWh
                if (prod > 50) fillColor = '#047857';
                else if (prod > 20) fillColor = '#10b981';
                else if (prod > 5) fillColor = '#6ee7b7';
                else fillColor = '#f1f5f9';
            }
        }

        return {
            color: isHover ? '#0f172a' : (isStripe ? '#94a3b8' : fillColor),
            weight: isHover ? 2 : 1,
            fillColor: isStripe ? '#cbd5e1' : fillColor,
            fillOpacity: isHover ? 0.9 : 0.7,
            dashArray: isStripe ? '4,4' : '' // Fake stripe with dash border for simplicity if needed
        };
    }

    // --- REQUÊTE SPATIALE (BBOX) ---
    async function loadBuildingsInView() {
        const zoom = map.getZoom();
        
        if (zoom < 16) {
            zoomWarning.classList.remove('hidden');
            return;
        } else {
            zoomWarning.classList.add('hidden');
        }

        const bounds = map.getBounds();
        const features = await fetchBuildings(bounds);
        
        // fetchBuildings renvoie null si la requête a été annulée (AbortController)
        if (features && features.length > 0) {
            renderDynamicFeatures(features);
        }
    }

    function renderDynamicFeatures(features) {
        // Filtrer uniquement les nouveaux bâtiments
        const newFeatures = features.filter(f => !cachedFeatures.has(f.properties.OBJECTID));
        if (newFeatures.length === 0) return;

        // Ajouter au cache
        newFeatures.forEach(f => cachedFeatures.set(f.properties.OBJECTID, f));

        // Créer un seul layer GeoJSON pour ce lot (bien plus performant)
        const geoJsonLayer = L.geoJSON(newFeatures, {
            style: (feature) => getStyleForFeature(feature, false),
            onEachFeature: (feature, layer) => {
                layer.on({
                    mouseover: (e) => {
                        const target = e.target;
                        target.setStyle(getStyleForFeature(feature, true));
                        target.bringToFront();
                    },
                    mouseout: (e) => {
                        geoJsonLayer.resetStyle(e.target);
                    },
                    click: (e) => {
                        showPopup(feature, e.latlng);
                    }
                });
            }
        });
        
        thematicLayerGroup.addLayer(geoJsonLayer);
    }

    function refreshAllStyles() {
        thematicLayerGroup.eachLayer(layer => {
            // layer est un L.geoJSON, on lui repasse la fonction de style
            if (layer.setStyle) {
                layer.setStyle((feature) => getStyleForFeature(feature, false));
            }
        });
    }

    // --- EVENTS ---
    let mapMoveTimer;
    map.on('moveend', () => {
        clearTimeout(mapMoveTimer);
        // Debounce de 300ms avant de déclencher la requête
        mapMoveTimer = setTimeout(() => {
            loadBuildingsInView();
        }, 300);
    });
    
    themeSelect.addEventListener('change', (e) => {
        currentTheme = e.target.value;
        updateLegend();
        refreshAllStyles();
    });

    updateLegend();
    // Appel initial
    loadBuildingsInView();


    // --- RECHERCHE PAR ADRESSE ---
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < 3) {
            resultsContainer.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            searchBuildings(query);
        }, 500);
    });

    async function searchBuildings(query) {
        const safeQuery = query.toUpperCase();
        const wildcardQuery = safeQuery
            .replace(/[EÉÈÊË]/g, '_')
            .replace(/[AÀÂÄ]/g, '_')
            .replace(/[IÎÏ]/g, '_')
            .replace(/[OÔÖ]/g, '_')
            .replace(/[UÙÛÜ]/g, '_')
            .replace(/[CÇ]/g, '_');

        const words = wildcardQuery.split(/[\s\-'']+/).filter(w => w.length > 2 || (!isNaN(w) && w.length > 0));
        if (words.length === 0) return;

        const whereClause = words.map(w => {
            if (!isNaN(w)) {
                return `(UPPER(ADRESSE) LIKE '${w} %' OR UPPER(ADRESSE) LIKE '% ${w} %' OR UPPER(ADRESSE) LIKE '% ${w}-%')`;
            }
            return `UPPER(ADRESSE) LIKE '%${w}%'`;
        }).join(' AND ');

        const url = `https://vector.sitg.ge.ch/arcgis/rest/services/OCEN_SOLAIRE_PV_BATIMENT/FeatureServer/0/query?where=${encodeURIComponent(whereClause)}&outFields=OBJECTID,ADRESSE,PV_AN_TOT,CO2,INVEST_TOT,GAINS_AN,PATRIM&outSR=4326&f=geojson&resultRecordCount=15`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                showResults(data.features);
            } else {
                resultsContainer.innerHTML = '<div style="padding: 1rem; color: #64748b;">Aucun bâtiment trouvé.</div>';
                resultsContainer.style.display = 'block';
            }
        } catch (error) {
            console.error("Erreur recherche", error);
        }
    }

    function showResults(features) {
        resultsContainer.innerHTML = '';
        features.forEach(feature => {
            const div = document.createElement('div');
            div.style.padding = '0.75rem 1.5rem';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #f1f5f9';
            div.innerText = feature.properties.ADRESSE || "Adresse inconnue";
            
            div.addEventListener('mouseover', () => div.style.backgroundColor = '#f8fafc');
            div.addEventListener('mouseout', () => div.style.backgroundColor = 'transparent');
            
            div.addEventListener('click', () => {
                selectBuilding(feature);
                resultsContainer.style.display = 'none';
                searchInput.value = feature.properties.ADRESSE;
            });

            resultsContainer.appendChild(div);
        });
        resultsContainer.style.display = 'block';
    }

    function selectBuilding(feature) {
        if (currentLayer) map.removeLayer(currentLayer);

        currentLayer = L.geoJSON(feature, {
            style: { color: '#0f172a', weight: 4, fillColor: '#fcd34d', fillOpacity: 0.8 }
        }).addTo(map);

        const bounds = currentLayer.getBounds();
        map.fitBounds(bounds, { maxZoom: 18, padding: [50, 50] });

        showPopup(feature, bounds.getCenter());
    }

    function showPopup(feature, latlng) {
        const props = feature.properties;
        const invest = props.INVEST_TOT || 0;
        const gains = props.GAINS_AN || 0;
        const roi = (invest > 0 && gains > 0) ? (invest / gains).toFixed(1) : "N/A";
        const menages = props.PV_AN_TOT ? Math.round(props.PV_AN_TOT / 3000) : 0;
        const format = (num) => new Intl.NumberFormat('fr-CH').format(num);

        const patrimInfo = props.PATRIM === 1 
            ? '<div style="color: #ef4444; font-size:0.8rem; margin-top:0.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">⚠️ Zone sous condition patrimoniale. Soumis à validation esthétique.</div>'
            : '<div style="color: #10b981; font-size:0.8rem; margin-top:0.5rem; border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">✅ Toit libre de contrainte patrimoniale.</div>';

        const popupContent = `
            <div class="building-popup">
                <h4>Bilan Solaire</h4>
                <ul>
                    <li><span>Production:</span> <span class="val">${format(props.PV_AN_TOT)} kWh/an</span></li>
                    <li><span>Équiv. ménages:</span> <span class="val" style="color: #10b981;">~${menages} foyer(s)</span></li>
                    <li><span>CO₂ évité:</span> <span class="val">${format(props.CO2)} kg/an</span></li>
                    <li><span>Investissement estimé:</span> <span class="val">${format(invest)} CHF</span></li>
                    <li><span>Gain estimé:</span> <span class="val">${format(gains)} CHF/an</span></li>
                    <li><span>Retour s/investissement:</span> <span class="val" style="color: #f59e0b;">~${roi} ans</span></li>
                </ul>
                ${patrimInfo}
                <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; line-height: 1.4; border-top: 1px dashed #e2e8f0; padding-top: 0.5rem;">
                    <em><strong>Méthode:</strong> Modélisation LiDAR de l'inclinaison, orientation et ombrages. Calculs G2 Solaire.</em>
                </div>
            </div>
        `;

        L.popup().setLatLng(latlng).setContent(popupContent).openOn(map);
    }

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });
}

import { initCharts } from './charts.js';
import { initMap } from './map.js';
import { renderAll } from './iconService.js';

// Fonction pour formater les nombres façon suisse
const formatNum = (num) => new Intl.NumberFormat('fr-CH').format(Math.round(num));

document.addEventListener('DOMContentLoaded', async () => {

    // Hydratation des icônes Lucide (data-icon="nom") dans tout le document
    renderAll();

    // Initialisation de la carte (ne dépend pas des données globales)
    try {
        initMap();
    } catch (e) {
        console.error("Erreur d'initialisation de la carte:", e);
    }

    // Chargement des données globales (précalculées depuis le CSV OCEN)
    try {
        const response = await fetch('data/summary.json');
        if (!response.ok) throw new Error('Impossible de charger les données.');

        const data = await response.json();

        // --- MISE À JOUR DES KPIs ---
        if (data.kpis) {
            const kpiGwh = document.getElementById('kpi-gwh');
            const kpiCo2 = document.getElementById('kpi-co2');
            const kpiRoi = document.getElementById('kpi-roi');

            if (kpiGwh) kpiGwh.textContent = formatNum(data.kpis.totalMwh / 1000);
            if (kpiCo2) kpiCo2.textContent = formatNum(data.kpis.totalCo2Tonnes / 1000);
            if (kpiRoi) kpiRoi.textContent = data.kpis.avgRoi ? data.kpis.avgRoi.toFixed(1) : "--";
        }

        // --- GÉNÉRATION DES GRAPHIQUES ---
        if (data.charts) {
            initCharts(data.charts);
        }

    } catch (error) {
        console.error("Erreur lors du chargement des données de synthèse :", error);

        // Affichage d'un message d'erreur si le JSON n'est pas généré
        const dashboard = document.querySelector('.dashboard-section .container');
        if (dashboard) {
            const errorDiv = document.createElement('div');
            // Pas d'inline style — la classe error-banner hérite des tokens OKLCH (style.css)
            errorDiv.className = 'error-banner';
            errorDiv.setAttribute('role', 'alert');
            errorDiv.innerHTML = '<strong>Données non trouvées.</strong> Veuillez exécuter le script <code>node scripts/generate_summary.js</code> pour générer les données de synthèse depuis le fichier officiel OCEN.';
            dashboard.prepend(errorDiv);
        }
    }

    // --- ANIMATIONS AU DÉFILEMENT (Intersection Observer) ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Cibler les éléments à animer
    const elementsToAnimate = document.querySelectorAll('.animate-on-scroll, .kpi-card, .chart-card, .edu-box');
    elementsToAnimate.forEach(el => {
        el.classList.add('animate-on-scroll'); // S'assurer que la classe de base est présente
        observer.observe(el);
    });

});

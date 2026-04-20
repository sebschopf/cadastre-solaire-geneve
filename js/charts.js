/**
 * @module charts
 * @description Responsabilité unique (SRP) : Initialisation et rendu des graphiques Chart.js.
 *
 * Toutes les couleurs sont lues depuis le système de tokens OKLCH (CSS :root)
 * via le module colorPalette — source unique de vérité. Aucune couleur n'est
 * déclarée ici en dur.
 *
 * @requires colorPalette.js
 * @requires Chart.js (global)
 */

import { chartColors } from './colorPalette.js';

/**
 * Initialise les trois graphiques du dashboard.
 * @param {Object} data - Données agrégées depuis l'API SITG.
 */
export function initCharts(data) {
    // -------------------------------------------------------------------------
    // Configuration globale Chart.js — couleurs depuis le système OKLCH
    // -------------------------------------------------------------------------
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.color = chartColors.grid.axisTitle;

    Chart.defaults.plugins.tooltip.backgroundColor  = chartColors.tooltip.background;
    Chart.defaults.plugins.tooltip.titleColor        = chartColors.tooltip.titleColor;
    Chart.defaults.plugins.tooltip.bodyColor         = chartColors.tooltip.bodyColor;
    Chart.defaults.plugins.tooltip.borderColor       = chartColors.tooltip.borderColor;
    Chart.defaults.plugins.tooltip.borderWidth       = 1;
    Chart.defaults.plugins.tooltip.padding           = 12;
    Chart.defaults.plugins.tooltip.cornerRadius      = 8;
    Chart.defaults.plugins.tooltip.displayColors     = true;
    Chart.defaults.plugins.tooltip.boxPadding        = 6;

    // -------------------------------------------------------------------------
    // 1. Graphique ROI — répartition des toitures par durée d'amortissement
    // -------------------------------------------------------------------------
    const ctxROI = document.getElementById('chartROI');
    if (ctxROI && data.roi) {
        new Chart(ctxROI, {
            type: 'bar',
            data: {
                labels  : Object.keys(data.roi),
                datasets: [{
                    label          : 'Nombre de toitures',
                    data           : Object.values(data.roi),
                    backgroundColor: chartColors.roi,
                    borderRadius   : 8,
                    borderSkipped  : false,
                    barPercentage  : 0.6,
                }],
            },
            options: {
                responsive         : true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid  : { color: chartColors.grid.line, drawBorder: false },
                        border: { display: false },
                    },
                    x: { grid: { display: false }, border: { display: false } },
                },
                animation: { duration: 1500, easing: 'easeOutQuart' },
            },
        });
    }

    // -------------------------------------------------------------------------
    // 2. Graphique Patrimoine — potentiel libre vs soumis à contrainte
    // -------------------------------------------------------------------------
    const ctxPatrimoine = document.getElementById('chartPatrimoine');
    if (ctxPatrimoine && data.patrimoine) {
        new Chart(ctxPatrimoine, {
            type: 'doughnut',
            data: {
                labels  : ['Potentiel Libre', 'Sous Conditions Patrimoniales'],
                datasets: [{
                    data           : [Math.round(data.patrimoine.libre), Math.round(data.patrimoine.bloque)],
                    backgroundColor: chartColors.patrimoine,
                    borderWidth    : 0,
                    hoverOffset    : 8,
                }],
            },
            options: {
                responsive         : true,
                maintainAspectRatio: false,
                cutout             : '70%',
                plugins: {
                    legend : { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                    tooltip: {
                        callbacks: { label: (c) => ` ${new Intl.NumberFormat('fr-CH').format(c.raw)} MWh` },
                    },
                },
                animation: { duration: 1500, easing: 'easeOutQuart' },
            },
        });
    }

    // -------------------------------------------------------------------------
    // 3. Graphique Top Communes — classement par potentiel libre et rentable
    // -------------------------------------------------------------------------
    const ctxCommunes = document.getElementById('chartCommunes');
    if (ctxCommunes && data.communes) {
        new Chart(ctxCommunes, {
            type: 'bar',
            data: {
                labels  : data.communes.map(item => item[0]),
                datasets: [{
                    label          : 'Potentiel "Libre & Rentable" (MWh/an)',
                    data           : data.communes.map(item => Math.round(item[1])),
                    backgroundColor: chartColors.communes,
                    borderRadius   : 6,
                    borderSkipped  : false,
                    barPercentage  : 0.7,
                }],
            },
            options: {
                responsive         : true,
                maintainAspectRatio: false,
                indexAxis          : 'y', // Barres horizontales
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid  : { color: chartColors.grid.line, drawBorder: false },
                        border: { display: false },
                        title : {
                            display: true,
                            text   : 'Énergie libre et amortie en < 15 ans (MWh/an)',
                            color  : chartColors.grid.axisTitle,
                        },
                    },
                    y: { grid: { display: false }, border: { display: false } },
                },
                animation: { duration: 1500, easing: 'easeOutQuart' },
            },
        });
    }
}

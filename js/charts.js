export function initCharts(data) {
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#0f172a';
    Chart.defaults.plugins.tooltip.bodyColor = '#475569';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(226, 232, 240, 0.8)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxPadding = 6;

    // 1. Graphique ROI
    const ctxROI = document.getElementById('chartROI');
    if (ctxROI && data.roi) {
        new Chart(ctxROI, {
            type: 'bar',
            data: {
                labels: Object.keys(data.roi),
                datasets: [{
                    label: 'Nombre de toitures',
                    data: Object.values(data.roi),
                    backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#cbd5e1'],
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.4)', drawBorder: false }, border: { display: false } },
                    x: { grid: { display: false }, border: { display: false } }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
            }
        });
    }

    // 2. Graphique Patrimoine
    const ctxPatrimoine = document.getElementById('chartPatrimoine');
    if (ctxPatrimoine && data.patrimoine) {
        new Chart(ctxPatrimoine, {
            type: 'doughnut',
            data: {
                labels: ['Potentiel Libre', 'Sous Conditions Patrimoniales'],
                datasets: [{
                    data: [Math.round(data.patrimoine.libre), Math.round(data.patrimoine.bloque)],
                    backgroundColor: ['#10b981', '#e2e8f0'],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                    tooltip: { 
                        callbacks: { 
                            label: (c) => ` ${new Intl.NumberFormat('fr-CH').format(c.raw)} MWh` 
                        } 
                    }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
            }
        });
    }

    // 3. Graphique Top Communes
    const ctxCommunes = document.getElementById('chartCommunes');
    if (ctxCommunes && data.communes) {
        new Chart(ctxCommunes, {
            type: 'bar',
            data: {
                labels: data.communes.map(item => item[0]),
                datasets: [{
                    label: 'Potentiel "Libre & Rentable" (MWh/an)',
                    data: data.communes.map(item => Math.round(item[1])),
                    backgroundColor: '#0f172a',
                    borderRadius: 6,
                    borderSkipped: false,
                    barPercentage: 0.7
                }]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                indexAxis: 'y', // Barres horizontales
                plugins: { legend: { display: false } },
                scales: {
                    x: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(226, 232, 240, 0.4)', drawBorder: false }, 
                        border: { display: false },
                        title: { display: true, text: 'Énergie libre et amortie en < 15 ans (MWh/an)', color: '#94a3b8' } 
                    },
                    y: { grid: { display: false }, border: { display: false } }
                },
                animation: { duration: 1500, easing: 'easeOutQuart' }
            }
        });
    }
}

import {
    toPanels,
    roofCoveragePercent,
    formatCHF,
} from './metricsService.js';
import { renderAll } from './iconService.js';

let panelEl, overlayEl, closeBtn, bodyEl;

export function initPanel() {
    panelEl   = document.getElementById('sidePanel');
    overlayEl = document.getElementById('sidePanelOverlay');
    closeBtn  = document.getElementById('sidePanelCloseBtn');
    bodyEl    = document.getElementById('sidePanelBody');
    // Le bouton impression est géré exclusivement par printService.js

    if (!panelEl) return;

    overlayEl.addEventListener('click', closePanel);
    closeBtn.addEventListener('click', closePanel);

    // Listen for Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelEl.classList.contains('is-open')) {
            closePanel();
        }
    });
}

export function openPanelWithData(props) {
    if (!panelEl || !bodyEl) return;

    const panels = toPanels(props.P_KWC_TOT);
    const coverage = roofCoveragePercent(props.AREA_PV_TOT, props.AREA_TOIT);
    const sub = props.SUB_AC_TOT || 0;

    const coverageLine = coverage !== null
        ? `<div class="panel-stat">
               <span class="panel-stat-label">Surface exploitable</span>
               <span class="panel-stat-val">${coverage}% du toit (${Math.round(props.AREA_PV_TOT)} m²)</span>
           </div>`
        : '';

    const subLine = sub > 0
        ? `<div class="panel-stat">
               <span class="panel-stat-label">Subvention estimée</span>
               <span class="panel-stat-val" title="Subvention d'autoconsommation (G2 Solaire)">${formatCHF(sub)} CHF</span>
           </div>`
        : '';

    const addressBlock = (props.ADRESSE || props.COMMUNE)
        ? `<p class="panel-address">
            <span class="icon" data-icon="map-pin" data-icon-size="16"></span>
            ${props.ADRESSE ? props.ADRESSE + ',' : ''} ${props.COMMUNE || ''}
           </p>`
        : '';

    const arbresEq = Math.round(props.CO2 / 25);
    const kmVoiture = Math.round(props.CO2 * 7.5); // ~133g CO2/km

    // Le TRI a besoin d'être importé de metricsService.js
    // Mais on peut le recalculer ou l'utiliser s'il est dans props.TRI
    const triValue = (props.TRI && props.TRI > 0 && props.TRI < 999)
        ? props.TRI.toFixed(1) + ' ans'
        : ((props.INVEST_TOT > 0 && props.GAINS_AN > 0) ? (props.INVEST_TOT / props.GAINS_AN).toFixed(1) + ' ans' : 'Non déterminé');

    // ── Injection dans l'en-tête d'impression ───────────────────────
    const addrEl = document.getElementById('printHeaderAddress');
    if (addrEl) {
        addrEl.textContent = [props.ADRESSE, props.COMMUNE].filter(Boolean).join(', ');
    }
    const dateEl = document.getElementById('printHeaderDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('fr-CH', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
    }

    bodyEl.innerHTML = `
        <div class="print-header-cover"></div>
        <div class="panel-header-doc">
            <h2 id="sidePanelTitle" class="panel-title">Rapport de Potentiel Solaire</h2>
            ${addressBlock}
            <p class="panel-subtitle">Analyse détaillée et personnalisée de votre toiture</p>
        </div>

        <div class="panel-section">
            <h3 class="panel-section-title">
                <span class="icon" data-icon="ruler" data-icon-size="20"></span>
                1. Analyse de la Toiture (LiDAR 3D)
            </h3>
            <p class="panel-text">
                <strong>Méthodologie (SITG / OCEN) :</strong> Les données ne reposent pas sur une simple estimation 2D. 
                L'ensemble du canton a été scanné par laser aéroporté (LiDAR). Ce modèle 3D prend en compte 
                l'<strong>inclinaison exacte</strong> de chaque pan de toit, son <strong>orientation</strong>, 
                ainsi que les <strong>ombrages</strong> créés par la végétation ou les bâtiments voisins tout au long de l'année.
            </p>
            <div class="panel-grid">
                <div class="panel-stat">
                    <span class="panel-stat-label">Surface de toit totale</span>
                    <span class="panel-stat-val">${Math.round(props.AREA_TOIT || 0)} m²</span>
                </div>
                ${coverageLine}
            </div>
            <div class="panel-note">
                <em>Critère de viabilité :</em> Seules les zones de toiture recevant un rayonnement solaire minimal de <strong>800 kWh/m²/an</strong> sont retenues. Les zones trop à l'ombre ou mal orientées (ex: plein Nord) sont exclues d'office pour garantir la rentabilité.
            </div>
        </div>

        <div class="panel-section">
            <h3 class="panel-section-title">
                <span class="icon" data-icon="zap" data-icon-size="20"></span>
                2. Rendement Technique Potentiel
            </h3>
            <p class="panel-text">
                <strong>Matériel projeté :</strong> Les calculs de puissance se basent sur l'installation de panneaux photovoltaïques monocristallins standards actuels, offrant un rendement d'environ 20 à 22%.
            </p>
            <div class="panel-grid">
                <div class="panel-stat">
                    <span class="panel-stat-label">Puissance installable maximale</span>
                    <span class="panel-stat-val">${props.P_KWC_TOT ? props.P_KWC_TOT.toFixed(1) : 'N/D'} kWc</span>
                    ${panels > 0 ? `<span class="panel-stat-sub">Correspond à environ ${panels} panneaux physiques.</span>` : ''}
                </div>
                <div class="panel-stat">
                    <span class="panel-stat-label">Production d'énergie estimée</span>
                    <span class="panel-stat-val">${formatCHF(props.PV_AN_TOT)} kWh/an</span>
                    <span class="panel-stat-sub">Énergie nette produite annuellement.</span>
                </div>
            </div>
        </div>

        <div class="panel-section">
            <h3 class="panel-section-title">
                <span class="icon" data-icon="leaf" data-icon-size="20"></span>
                3. Impact Environnemental
            </h3>
            <p class="panel-text">
                En produisant de l'électricité localement d'origine renouvelable, vous évitez que cette électricité ne soit importée et produite par des centrales fossiles (gaz, charbon) présentes dans le mix européen.
            </p>
            <div class="panel-grid">
                <div class="panel-stat">
                    <span class="panel-stat-label">Émissions de CO₂ évitées</span>
                    <span class="panel-stat-val eco-text">${formatCHF(props.CO2)} kg/an</span>
                </div>
            </div>
            <div class="panel-equivalence">
                <strong>Concrètement, cela représente quoi ?</strong><br>
                Dans la réalité, l'économie de ${formatCHF(props.CO2)} kg de CO₂ par an équivaut environ à :
                <ul>
                    <li><span class="icon" data-icon="plane" data-icon-size="14"></span> L'absorption carbone d'environ <strong>${formatCHF(arbresEq)} arbres</strong> adultes sur une année entière.</li>
                    <li><span class="icon" data-icon="sun" data-icon-size="14"></span> Ne pas parcourir <strong>${formatCHF(kmVoiture)} kilomètres</strong> au volant d'une voiture thermique standard.</li>
                </ul>
            </div>
        </div>

        <div class="panel-section">
            <h3 class="panel-section-title">
                <span class="icon" data-icon="landmark" data-icon-size="20"></span>
                4. Bilan Financier & Rentabilité
            </h3>
            <p class="panel-text">
                <strong>Méthodologie financière (G2 Solaire) :</strong> Le modèle économique intègre l'ensemble des coûts (achat, pose, onduleur, entretien moyen) et des recettes (autoconsommation qui allège votre facture électrique, revente de l'excédent aux SIG, et subvention fédérale Pronovo).
            </p>
            <div class="panel-grid">
                <div class="panel-stat">
                    <span class="panel-stat-label">Investissement initial total</span>
                    <span class="panel-stat-val">${formatCHF(props.INVEST_TOT)} CHF</span>
                    <span class="panel-stat-sub">Matériel et pose compris.</span>
                </div>
                ${sub > 0 ? `
                <div class="panel-stat">
                    <span class="panel-stat-label">Subvention fédérale (Pronovo)</span>
                    <span class="panel-stat-val success-text">-${formatCHF(sub)} CHF</span>
                    <span class="panel-stat-sub">Rétribution unique (RU) estimée.</span>
                </div>` : ''}
                <div class="panel-stat">
                    <span class="panel-stat-label">Gain annuel récurrent</span>
                    <span class="panel-stat-val success-text">+${formatCHF(props.GAINS_AN)} CHF/an</span>
                    <span class="panel-stat-sub">Autoconsommation + revente (SIG).</span>
                </div>
                <div class="panel-stat">
                    <span class="panel-stat-label">Retour sur Investissement (TRI)</span>
                    <span class="panel-stat-val neutral-text">${triValue}</span>
                    <span class="panel-stat-sub">Années pour amortir le système.</span>
                </div>
            </div>
        </div>

        <div class="panel-footer-info">
            <p><strong>Rapport généré le ${new Date().toLocaleDateString('fr-CH')} par le Cadastre Solaire Genève.</strong></p>
            <p><em>Sources officielles : État de Genève (OCEN), SITG, Modèle de calcul G2 Solaire transfrontalier.</em></p>
            <p>Ces chiffres sont des estimations théoriques destinées à faciliter la prise de décision. Elles ne remplacent pas un devis réalisé par un installateur professionnel certifié.</p>
        </div>
    `;

    renderAll(bodyEl);
    panelEl.classList.add('is-open');
    panelEl.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
}

export function closePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('is-open');
    panelEl.setAttribute('aria-hidden', 'true');
}

const fs = require('fs');
const readline = require('readline');

const csvPath = '../OCEN_SOLAIRE_PV_BATIMENT-CSV/OCEN_SOLAIRE_PV_BATIMENT.csv';
const outputPath = '../data/summary.json';

async function processData() {
    if (!fs.existsSync('../data')) {
        fs.mkdirSync('../data');
    }

    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let totalMwh = 0;
    let totalCo2Tonnes = 0;
    let totalBuildings = 0;

    let mwhLibre = 0;
    let mwhBloque = 0;

    let roiBuckets = { "< 10 ans": 0, "10 à 15 ans": 0, "15 à 20 ans": 0, "> 20 ans": 0 };
    let validRoiCount = 0;
    let sumRoiYears = 0;

    let topCommunesParfaites = {}; // Commune -> MWh

    let isFirstLine = true;
    let headers = [];

    for await (const line of rl) {
        if (isFirstLine) {
            headers = line.split(';');
            isFirstLine = false;
            continue;
        }

        const cols = line.split(';');
        if (cols.length < headers.length) continue;

        const getCol = (name) => cols[headers.indexOf(name)];

        const prodKwh = parseFloat(getCol('PV_AN_TOT')) || 0;
        const prodMwh = prodKwh / 1000;
        const co2Kg = parseFloat(getCol('CO2')) || 0;
        
        let invest = parseFloat(getCol('INVEST_TOT')) || parseFloat(getCol('INVEST')) || 0;
        let gains = parseFloat(getCol('GAINS_AN')) || 0;
        
        // Handling negative values or missing
        if (invest < 0) invest = 0;
        if (gains < 0) gains = 0;

        const patrim = getCol('PATRIM'); // 1 = contrainte, 0 = libre
        const commune = getCol('COMMUNE');

        if (prodMwh <= 0 || !commune) continue;

        totalBuildings++;
        totalMwh += prodMwh;
        totalCo2Tonnes += (co2Kg / 1000);

        // Analyse Patrimoniale
        if (patrim === '1') mwhBloque += prodMwh;
        else mwhLibre += prodMwh;

        // Analyse Économique (ROI)
        let paybackYears = 0;
        if (invest > 0 && gains > 0) {
            paybackYears = invest / gains;
            sumRoiYears += paybackYears;
            validRoiCount++;

            if (paybackYears < 10) roiBuckets["< 10 ans"]++;
            else if (paybackYears < 15) roiBuckets["10 à 15 ans"]++;
            else if (paybackYears < 20) roiBuckets["15 à 20 ans"]++;
            else roiBuckets["> 20 ans"]++;
        }

        // Communes Parfaites
        if (patrim === '0' && paybackYears > 0 && paybackYears <= 15) {
            if (!topCommunesParfaites[commune]) topCommunesParfaites[commune] = 0;
            topCommunesParfaites[commune] += prodMwh;
        }
    }

    const sortedCommunes = Object.entries(topCommunesParfaites)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12); // Top 12

    const avgRoi = validRoiCount > 0 ? (sumRoiYears / validRoiCount) : null;

    const summary = {
        kpis: {
            totalMwh,
            totalCo2Tonnes,
            totalBuildings,
            avgRoi
        },
        charts: {
            patrimoine: {
                libre: mwhLibre,
                bloque: mwhBloque
            },
            roi: roiBuckets,
            communes: sortedCommunes
        }
    };

    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log('Summary successfully created at', outputPath);
}

processData().catch(console.error);

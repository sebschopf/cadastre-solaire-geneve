
async function testCORS() {
    const url = 'https://vector.sitg.ge.ch/arcgis/rest/services/OCEN_SOLAIRE_PV_BATIMENT/FeatureServer/0/query?f=json&where=1%3D1&resultRecordCount=1';
    try {
        const response = await fetch(url);
        console.log('CORS test status:', response.status);
        console.log('CORS headers:', [...response.headers.entries()]);
    } catch (e) {
        console.error('CORS test failed:', e.message);
    }
}
testCORS();

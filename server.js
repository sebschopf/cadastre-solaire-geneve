/**
 * @file server.js
 * @description Serveur de développement local.
 * 
 * Gère deux choses:
 * 1. /api/proxy → proxy CORS vers vector.sitg.ge.ch (même logique que api/proxy.js)
 * 2. Tout le reste → fichiers statiques depuis le répertoire courant
 * 
 * Usage: node server.js
 * Puis ouvrir: http://localhost:3000
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 3000;

// Types MIME pour les fichiers statiques
const MIME_TYPES = {
    '.html' : 'text/html; charset=utf-8',
    '.css'  : 'text/css; charset=utf-8',
    '.js'   : 'application/javascript; charset=utf-8',
    '.json' : 'application/json; charset=utf-8',
    '.png'  : 'image/png',
    '.jpg'  : 'image/jpeg',
    '.svg'  : 'image/svg+xml',
    '.ico'  : 'image/x-icon',
    '.pdf'  : 'application/pdf',
    '.xml'  : 'application/xml',
};

const BASE_URL = 'http://localhost:3000';

const server = http.createServer((req, res) => {
    // API WHATWG (moderne) — remplace url.parse() déprécié
    const parsedUrl = new URL(req.url, BASE_URL);
    const pathname  = parsedUrl.pathname;

    // ── PROXY CORS (/api/proxy) ────────────────────────────
    if (pathname === '/api/proxy') {
        handleProxy(req, res, parsedUrl.searchParams);
        return;
    }

    // ── FICHIERS STATIQUES ─────────────────────────────────
    serveStatic(req, res, pathname);
});

/**
 * Proxy CORS vers vector.sitg.ge.ch
 * Même logique que api/proxy.js (Vercel Function de production)
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 * @param {URLSearchParams}      params
 */
function handleProxy(req, res, params) {
    const targetUrl = params.get('url');

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'URL is required' }));
        return;
    }

    if (!targetUrl.startsWith('https://vector.sitg.ge.ch/')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Accès refusé. Ce proxy est réservé aux données de l\'État de Genève.' }));
        return;
    }

    const decodedUrl = decodeURIComponent(targetUrl);

    // Note: on ne demande PAS gzip ici car notre serveur local ne décompresse pas.
    // (Vercel Function décompresse automatiquement en production.)
    https.get(decodedUrl, {
        headers: {
            'Accept': 'application/json',
        },
    }, (proxyRes) => {
        const chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk));
        proxyRes.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            res.writeHead(200, {
                'Content-Type'                : 'application/json',
                'Access-Control-Allow-Origin' : '*',
                'Access-Control-Allow-Methods': 'GET',
                'Cache-Control'               : 'max-age=3600',
            });
            res.end(body);
        });
    }).on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
    });
}

/**
 * Sert les fichiers statiques depuis le répertoire courant
 */
function serveStatic(req, res, pathname) {
    // index.html par défaut
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

    // Sécurité: empêche la traversée de répertoire
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        // Si c'est un dossier, cherche index.html dedans
        if (!err && stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`404 – ${pathname} introuvable`);
                return;
            }

            const ext      = path.extname(filePath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content);
        });
    });
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} déjà utilisé.`);
        console.error(`   Arrêtez l'autre processus avec: fuser -k ${PORT}/tcp`);
        console.error(`   Puis relancez: npm run dev\n`);
    } else {
        console.error('Erreur serveur:', err);
    }
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`\n✅ Serveur local démarré`);
    console.log(`   → http://localhost:${PORT}`);
    console.log(`   → API proxy actif: /api/proxy?url=...`);
    console.log(`\n   Ctrl+C pour arrêter\n`);
});

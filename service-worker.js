const CACHE_NAME = 'rice-erp-v1';

// Only cache static shell files - never cache API/data calls
const STATIC_ASSETS = [
    '/index.html',
    '/dashboard.html',
    '/css/variables.css',
    '/css/main.css',
    '/css/layout.css',
    '/js/layout.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch(() => {
                // If some files fail to cache, don't block installation
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache Supabase API calls - always fetch fresh data
    if (url.hostname.includes('supabase.co')) {
        return;
    }

    // Network-first strategy: try network, fall back to cache if offline
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

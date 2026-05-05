// Service Worker for IntelliRack Device Discovery
const CACHE_NAME = "intellirack-v1";

self.addEventListener("install", (event) => {
	console.log("IntelliRack Service Worker installing...");
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	console.log("IntelliRack Service Worker activating...");
	event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
	// Handle device discovery requests
	if (event.request.url.includes("/api/discovery")) {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					// Cache successful discovery responses
					if (response.ok) {
						const responseClone = response.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(event.request, responseClone);
						});
					}
					return response;
				})
				.catch(() => {
					// Return cached response if available
					return caches.match(event.request);
				})
		);
	}
});

// Handle messages from the main thread
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "DISCOVER_DEVICES") {
		// Handle device discovery requests
		console.log("Service worker received discovery request");
	}
});

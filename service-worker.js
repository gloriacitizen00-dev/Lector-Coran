const CACHE_NAME = "lector-coran-v9";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./noble-quran_span.pdf",
  "./audio/musica.mp3",
  "./pdfjs/pdf.min.js",
  "./pdfjs/pdf.worker.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ARCHIVOS);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    const url = new URL(event.request.url);
    const pdfUrl = new URL("noble-quran_span.pdf", self.registration.scope);

    // Atender solicitudes parciales del PDF desde la copia guardada.
    if (url.href === pdfUrl.href) {
      const cachedPdf = await caches.match(pdfUrl.href);

      if (cachedPdf) {
        const range = event.request.headers.get("Range");

        if (range) {
          const match = range.match(/bytes=(\d*)-(\d*)/);

          if (match) {
            const data = await cachedPdf.arrayBuffer();
            const total = data.byteLength;

            let start = match[1] ? Number(match[1]) : 0;
            let end = match[2] ? Number(match[2]) : total - 1;

            if (!match[1] && match[2]) {
              const suffixLength = Number(match[2]);
              start = Math.max(total - suffixLength, 0);
              end = total - 1;
            }

            if (start <= end && start < total) {
              end = Math.min(end, total - 1);

              return new Response(data.slice(start, end + 1), {
                status: 206,
                headers: {
                  "Content-Type": "application/pdf",
                  "Accept-Ranges": "bytes",
                  "Content-Range": `bytes ${start}-${end}/${total}`,
                  "Content-Length": String(end - start + 1)
                }
              });
            }

            return new Response(null, {
              status: 416,
              headers: {
                "Content-Range": `bytes */${total}`
              }
            });
          }
        }

        return cachedPdf;
      }
    }

    const cached = await caches.match(event.request, {
      ignoreSearch: true
    });

    if (cached) return cached;

    return fetch(event.request);
  })());
});

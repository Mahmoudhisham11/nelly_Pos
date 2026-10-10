const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Start a lightweight local static HTTP server for the Next.js exported static build.
 * @param {string} staticDir - Absolute path to the `out` directory.
 * @returns {Promise<{server: http.Server, port: number, url: string}>}
 */
function startStaticServer(staticDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let reqPath = decodeURIComponent(req.url.split("?")[0]);
        if (reqPath === "/") reqPath = "/index.html";

        let filePath = path.join(staticDir, reqPath);

        // Security check: ensure path is within staticDir
        if (!filePath.startsWith(staticDir)) {
          res.writeHead(403);
          return res.end("Forbidden");
        }

        // Try exact file, then dir/index.html, then file.html, then fallback to /index.html (SPA)
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          const indexHtml = path.join(filePath, "index.html");
          if (fs.existsSync(indexHtml)) {
            filePath = indexHtml;
          }
        }

        if (!fs.existsSync(filePath)) {
          if (fs.existsSync(filePath + ".html")) {
            filePath = filePath + ".html";
          } else if (fs.existsSync(path.join(staticDir, "index.html"))) {
            filePath = path.join(staticDir, "index.html");
          } else {
            res.writeHead(404);
            return res.end("Not Found");
          }
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(content);
      } catch (err) {
        console.error("[StaticServer Error]", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    });

    const PREFERRED_PORT = 34567;

    const tryListen = (port) => {
      server.listen(port, "127.0.0.1", () => {
        const address = server.address();
        const actualPort = address.port;
        const url = `http://127.0.0.1:${actualPort}`;
        console.log(`[StaticServer] Serving Next.js export from ${staticDir} at ${url}`);
        resolve({ server, port: actualPort, url });
      });
    };

    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`[StaticServer] Preferred port ${PREFERRED_PORT} is in use, falling back to dynamic port...`);
        tryListen(0);
      } else {
        reject(err);
      }
    });

    tryListen(PREFERRED_PORT);
  });
}

module.exports = { startStaticServer };

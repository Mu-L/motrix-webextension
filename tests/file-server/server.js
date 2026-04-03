'use strict';

const http = require('http');

/**
 * Minimal HTTP server that serves synthetic downloadable files.
 * Files are streamed as zero-filled bytes so no large assets need to live in the repo.
 * The server sets correct Content-Length and Content-Disposition headers so
 * Chrome can determine file size before the extension intercepts the download.
 *
 * Large files (large.bin) include a `dataDelayMs` so that Chrome receives the
 * response headers — triggering downloads.onCreated and giving the extension
 * time to call pause()/cancel() — before any bytes are delivered.  Without
 * this delay, loopback speeds (≈ 100 MB/s) can complete a 15 MB download
 * faster than the MV3 service worker can issue a cancel(), causing "no file on
 * disk" assertions to fail.
 */

const FILES = {
  'large.bin': {
    size: 15 * 1024 * 1024, // 15 MB — above any sane minFileSize default
    type: 'application/octet-stream',
    // Delay the first data byte by 5 s.
    //
    // Chrome fires downloads.onCreated as soon as the response HEADERS arrive,
    // giving the extension plenty of time to call cancel() before any bytes
    // flow.  Our "no files on disk" checks run at most ~2 s after addUri is
    // received, so 5 s of head-room makes it structurally impossible for a
    // complete file to land on disk before the assertion.
    dataDelayMs: 5000,
  },
  'small.txt': {
    size: 100 * 1024, // 100 KB — below 1 MB threshold used in bypass tests
    type: 'text/plain',
    dataDelayMs: 0,
  },
  // Tiny file whose URL contains "blacklisted" — used in the blacklist bypass
  // test so the browser download completes in milliseconds and doesn't linger
  // as a background transfer into subsequent tests.
  'blacklisted-mini.bin': {
    size: 10 * 1024, // 10 KB
    type: 'application/octet-stream',
    dataDelayMs: 0,
  },
  // Tiny file used for fallback and "disabled" bypass tests — completes quickly.
  'mini.bin': {
    size: 10 * 1024, // 10 KB
    type: 'application/octet-stream',
    dataDelayMs: 0,
  },
};

class FileServer {
  #server = null;
  #port;

  constructor(port = 8080) {
    this.#port = port;
  }

  get baseUrl() {
    return `http://127.0.0.1:${this.#port}`;
  }

  /** Start listening. Resolves when the port is bound. */
  async start() {
    this.#server = http.createServer((req, res) => this.#handle(req, res));
    await new Promise((resolve, reject) => {
      this.#server.listen(this.#port, '127.0.0.1', resolve);
      this.#server.once('error', reject);
    });
  }

  /** Stop the server. */
  async stop() {
    await new Promise((resolve) => this.#server.close(resolve));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #handle(req, res) {
    const pathname = new URL(req.url, this.baseUrl).pathname;

    if (pathname === '/') {
      return this.#serveIndex(res);
    }

    const match = pathname.match(/^\/files\/(.+)$/);
    if (match) {
      const filename = decodeURIComponent(match[1]);
      const meta = FILES[filename];
      if (meta) return this.#serveFile(req, res, filename, meta);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  #serveIndex(res) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Motrix E2E Test File Server</title></head>
<body>
  <h1>Motrix Extension Test Files</h1>
  <ul>
    <li><a id="large-download"       href="/files/large.bin"            download="large.bin">large.bin (15 MB)</a></li>
    <li><a id="small-download"       href="/files/small.txt"            download="small.txt">small.txt (100 KB)</a></li>
    <li><a id="blacklisted-download" href="/files/blacklisted-mini.bin" download="blacklisted-mini.bin">blacklisted-mini.bin (10 KB)</a></li>
    <li><a id="mini-download"        href="/files/mini.bin"             download="mini.bin">mini.bin (10 KB)</a></li>
  </ul>
</body>
</html>`;
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(html),
    });
    res.end(html);
  }

  #serveFile(req, res, filename, { size, type, dataDelayMs }) {
    // Send headers immediately so Chrome creates the download item and fires
    // downloads.onCreated before any data arrives.
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': size,
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Prevent caching so repeated test runs always trigger fresh downloads
      'Cache-Control': 'no-store',
    });

    req.on('close', () => res.destroy());

    const CHUNK = Buffer.alloc(64 * 1024, 0); // 64 KB of zeros

    const streamFrom = (startOffset) => {
      let sent = startOffset;
      const writeNext = () => {
        if (res.destroyed) return;
        if (sent >= size) { res.end(); return; }
        const toSend = Math.min(CHUNK.length, size - sent);
        sent += toSend;
        const ok = res.write(toSend === CHUNK.length ? CHUNK : CHUNK.slice(0, toSend));
        if (ok) setImmediate(writeNext);
        else res.once('drain', writeNext);
      };
      writeNext();
    };

    if (dataDelayMs <= 0) {
      streamFrom(0);
      return;
    }

    // For large files that need a data delay:
    //
    // Chrome only fires downloads.onChanged with the filename after it starts
    // writing bytes to disk — not from headers alone.  So we send a small
    // "trigger" chunk immediately so that:
    //   • downloads.onCreated fires  → extension pauses the download
    //   • downloads.onChanged(filename) fires → extension resolves waitForFilename()
    //   • extension calls addUri + cancel() → HTTP connection is closed
    //
    // The bulk of the file is held behind `dataDelayMs`.  By the time that
    // timer fires, the connection is already closed (the extension cancelled it),
    // so the server skips writing.  This ensures our "no completed file on disk"
    // assertion is never racing against the file server.
    const TRIGGER = Buffer.alloc(256, 0); // 256 bytes — tiny enough to not matter
    res.write(TRIGGER);

    const timer = setTimeout(() => streamFrom(TRIGGER.length), dataDelayMs);
    res.on('close', () => clearTimeout(timer));
  }
}

module.exports = FileServer;

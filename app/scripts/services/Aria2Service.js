import Aria2 from 'aria2';

class Aria2Service {
  #connection = null;
  #connectingPromise = null; // guards against concurrent connection attempts
  #options = null;
  #handlers = new Map(); // gid -> { onStart, onComplete, onStop, onError }

  configure(options) {
    if (JSON.stringify(options) === JSON.stringify(this.#options)) return;
    this.#options = options;
    if (this.#connection) {
      this.#connection.close().catch(() => {});
      this.#connection = null;
    }
    this.#connectingPromise = null;
  }

  async #connect() {
    if (!this.#options) throw new Error('Aria2Service: configure() must be called before use');

    const conn = new Aria2(this.#options);
    await conn.open();

    conn.addEventListener('onDownloadStart', ({ params: [{ gid }] }) => {
      this.#handlers.get(gid)?.onStart?.();
    });
    conn.addEventListener('onDownloadComplete', ({ params: [{ gid }] }) => {
      this.#handlers.get(gid)?.onComplete?.();
    });
    conn.addEventListener('onDownloadStop', ({ params: [{ gid }] }) => {
      this.#handlers.get(gid)?.onStop?.();
    });
    conn.addEventListener('onDownloadError', ({ params: [{ gid }] }) => {
      this.#handlers.get(gid)?.onError?.();
    });

    conn.addEventListener('close', () => {
      this.#connection = null;
      this.#connectingPromise = null;
    });

    return conn;
  }

  async #getConnection() {
    if (this.#connection) return this.#connection;

    // Deduplicate concurrent connection attempts — share the in-flight promise
    if (!this.#connectingPromise) {
      this.#connectingPromise = this.#connect()
        .then((conn) => {
          this.#connection = conn;
          this.#connectingPromise = null;
          return conn;
        })
        .catch((err) => {
          this.#connectingPromise = null;
          throw err;
        });
    }

    return this.#connectingPromise;
  }

  async ping() {
    const conn = await this.#getConnection();
    await conn.call('getVersion');
  }

  async addUri(url, params) {
    const conn = await this.#getConnection();
    return conn.call('addUri', [url], params);
  }

  async getStatus(gid) {
    const conn = await this.#getConnection();
    return conn.call('tellStatus', gid);
  }

  register(gid, handlers) {
    this.#handlers.set(gid, handlers);
  }

  unregister(gid) {
    this.#handlers.delete(gid);
  }
}

export const aria2Service = new Aria2Service();

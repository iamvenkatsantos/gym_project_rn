// Node entry: the same update server on our own machine, files in a folder.
//   UPDATES_DATA_DIR=/srv/corefit-updates PUBLISH_TOKEN=... PORT=8787 node src/node.js
// Put it behind a reverse proxy (Caddy, nginx) for HTTPS on updates.vinven.net.
// Moving off R2: copy the bucket into UPDATES_DATA_DIR (rclone copy r2:corefit-updates <dir>).
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { handleRequest } from './server.js';

export function folderStore(root) {
  const base = resolve(root);
  const pathFor = (key) => {
    const full = resolve(base, key);
    if (!full.startsWith(base + sep)) throw new Error('Bad key');
    return full;
  };
  return {
    async get(key) {
      const file = pathFor(key);
      try {
        const info = await stat(file);
        if (!info.isFile()) return null;
        return { body: Readable.toWeb(createReadStream(file)), size: info.size };
      } catch {
        return null;
      }
    },
    async put(key, body) {
      const file = pathFor(key);
      await mkdir(dirname(file), { recursive: true });
      // Write then rename would be safer for big files; these are small and written once.
      await writeFile(file, new Uint8Array(body));
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
    async list(prefix) {
      // Every file under the folder, as store keys ("updates/1.0.0/android/<id>.json").
      const folder = prefix.replace(/\/$/, '');
      try {
        const names = await readdir(pathFor(folder), { recursive: true, withFileTypes: true });
        return names
          .filter((entry) => entry.isFile())
          .map((entry) =>
            relative(base, `${entry.parentPath}${sep}${entry.name}`).split(sep).join('/'),
          );
      } catch {
        return [];
      }
    },
  };
}

export function startServer({ dataDir, publishToken, port }) {
  const store = folderStore(dataDir);
  const server = createServer(async (req, res) => {
    const host = req.headers.host ?? 'localhost';
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(`http://${host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? 'half' : undefined,
    });
    const response = await handleRequest(request, store, { publishToken });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  });
  return new Promise((done) => server.listen(port, () => done(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.env.UPDATES_DATA_DIR ?? './data';
  const port = Number(process.env.PORT ?? 8787);
  await startServer({ dataDir, publishToken: process.env.PUBLISH_TOKEN, port });
  console.log(`CoreFit update server on :${port}, files in ${resolve(dataDir)}`);
}

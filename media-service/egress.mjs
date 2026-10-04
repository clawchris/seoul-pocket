import http from 'node:http';
import net from 'node:net';
import dns from 'node:dns/promises';
import {once} from 'node:events';

const BLOCKED = [
  [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
  [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
  [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24], [0xcb007100, 24],
  [0xe0000000, 4], [0xf0000000, 4]
];

export function isPublicIPv4(address) {
  if (net.isIP(address) !== 4) return false;
  const value = address.split('.').reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
  return !BLOCKED.some(([network, bits]) => {
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (network & mask);
  });
}

/** A local-only HTTPS CONNECT proxy. DNS is resolved here and the socket uses the vetted IP, so DNS rebinding cannot change the target. */
export async function createPublicEgressProxy({lookup = dns.lookup} = {}) {
  const sockets = new Set();
  const server = http.createServer((_req, res) => { res.writeHead(403, {'Cache-Control':'no-store'}); res.end(); });
  server.on('connect', async (req, client, head) => {
    sockets.add(client); client.on('close', () => sockets.delete(client));
    const deny = () => { if (!client.destroyed) client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); };
    try {
      const match = /^([a-z0-9.-]+):443$/i.exec(req.url);
      if (!match || !/^[a-z0-9.-]+$/i.test(match[1])) return deny();
      const host = match[1].toLowerCase();
      const addresses = net.isIP(host) === 4 ? [{address:host}] : await lookup(host, {family:4, all:true});
      if (!addresses.length || addresses.some(item => !isPublicIPv4(item.address))) return deny();
      const upstream = net.connect({host:addresses[0].address, port:443, timeout:15000});
      sockets.add(upstream); upstream.on('close', () => sockets.delete(upstream));
      upstream.on('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        client.pipe(upstream).pipe(client);
      });
      upstream.on('timeout', () => upstream.destroy());
      upstream.on('error', () => { if (!client.destroyed) client.destroy(); });
      client.on('error', () => upstream.destroy());
    } catch { deny(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {
    url:`http://127.0.0.1:${server.address().port}`,
    async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); }
  };
}

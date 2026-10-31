import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http2 from 'node:http2'
import https from 'node:https'

// ─────────────────────────────────────────────────────────────────────────────
// Прокси к API журнала.
//
// API закрыт DDoS-Guard, поэтому:
//  - обычные HTTP/1.1 запросы из Node блокируются (403);
//  - GET и авторизованные POST проходят по HTTP/2 (node:http2);
//  - /auth/login и /auth/refresh (неавторизованные POST) проходят по HTTP/1.1.
//
// Прокси работает и в dev (npm run dev), и в prod-сборке (npm run preview).
// ─────────────────────────────────────────────────────────────────────────────

const MSAPI_HOST = 'msapi.top-academy.ru'
// Пути, которые всегда идут по HTTP/1.1 (иначе DDoS-Guard молча режет ответ)
const H1_PATHS = ['/api/v2/auth/login', '/api/v2/auth/refresh']

const BASE_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  referer: 'https://journal.top-academy.ru/',
  origin: 'https://journal.top-academy.ru',
  'accept-encoding': 'identity',
}

/** Запрос по HTTP/2 */
function h2Request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    let settled = false
    const session = http2.connect(`https://${MSAPI_HOST}`)
    const finish = (fn, arg) => {
      if (!settled) { settled = true; fn(arg) }
      try { session.close() } catch { /* noop */ }
    }
    session.on('error', (e) => finish(reject, e))
    const req = session.request({ ':method': method, ':path': path, ...headers })
    req.setTimeout(45000, () => finish(reject, new Error('upstream timeout')))
    let raw = []
    let size = 0
    req.on('data', (c) => { size += c.length; if (size < 30 * 1024 * 1024) raw.push(c) })
    req.on('response', (h) => {
      req.on('end', () => {
        finish(resolve, {
          status: h[':status'] || 500,
          contentType: h['content-type'] || 'application/json',
          body: Buffer.concat(raw),
        })
      })
    })
    req.on('error', (e) => finish(reject, e))
    if (body) req.write(body)
    req.end()
  })
}

/** Запрос по HTTP/1.1 */
function h1Request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: MSAPI_HOST, path, method, headers, timeout: 45000 },
      (res) => {
        const raw = []
        res.on('data', (c) => raw.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode || 500,
            contentType: res.headers['content-type'] || 'application/json',
            body: Buffer.concat(raw),
          })
        )
      }
    )
    req.on('timeout', () => { req.destroy(new Error('upstream timeout')) })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

const HOP_HEADERS = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-connection', 'content-length', 'accept-encoding', 'sec-fetch-mode',
  'sec-fetch-site', 'sec-fetch-dest', 'referer', 'origin', 'user-agent', 'cookie',
])

/** Пробует основной транспорт, при признаках блокировки — резервный */
async function forward(method, path, reqHeaders, body) {
  const useH1First = H1_PATHS.some((p) => path.startsWith(p))
  const transports = useH1First
    ? [h1Request, h2Request]
    : [h2Request, h1Request]

  let last = null
  for (let i = 0; i < transports.length; i++) {
    try {
      const res = await transports[i](method, path, reqHeaders, body)
      const blockedLike =
        res.status === 403 ||
        res.status === 503 ||
        // DDoS-Guard молча возвращает пустой 200 на неавторизованные POST
        (res.status === 200 && res.body.length === 0 && method === 'POST' && i === 0)
      last = res
      if (!blockedLike) return res
    } catch (e) {
      last = { status: 502, contentType: 'application/json', body: Buffer.from(JSON.stringify({ message: 'Proxy transport error: ' + e.message })) }
    }
  }
  return last
}

function makeProxyHandler() {
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname + url.search
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks)

    const headers = { ...BASE_HEADERS, accept: req.headers.accept || 'application/json, text/plain, */*' }
    for (const [k, v] of Object.entries(req.headers)) {
      const kl = k.toLowerCase()
      if (HOP_HEADERS.has(kl)) continue
      if (kl === 'authorization' || kl === 'accept-language' || kl === 'content-type') headers[kl] = v
    }
    if (body.length) headers['content-type'] = headers['content-type'] || 'application/json'

    try {
      const upstream = await forward(req.method, path, headers, body.length ? body : null)
      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.contentType)
      res.setHeader('Cache-Control', 'no-store')
      res.end(upstream.body)
    } catch (e) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ message: 'Proxy error: ' + e.message }))
    }
  }
}

const proxyPlugin = {
  name: 'msapi-h2-proxy',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api/')) return makeProxyHandler()(req, res)
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api/')) return makeProxyHandler()(req, res)
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), proxyPlugin],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1600 },
})

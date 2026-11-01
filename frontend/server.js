// ─────────────────────────────────────────────────────────────────────────────
// server.js — production-сервер для хостинга (Render и т.п.)
//
// Что делает:
//  1. Раздаёт собранный фронтенд из папки dist (с gzip и SPA-фолбэком);
//  2. Проксирует /api/v2/* на API журнала (та же логика h2/h1, что в vite.config.js);
//  3. Защищает прокси: allowlist хостов, проверка Origin, лимиты запросов
//     и (по желанию) пароль на весь сайт через переменную SITE_PASSWORD.
//
// Зависимостей нет — только встроенные модули Node.
// Запуск: npm run build && npm start
// ─────────────────────────────────────────────────────────────────────────────
import http from 'node:http'
import http2 from 'node:http2'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT) || 3000
const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0'
const SITE_PASSWORD = process.env.SITE_PASSWORD || ''

const MSAPI_HOST = 'msapi.top-academy.ru'
const PROXY_PREFIX = '/api/v2/'
const H1_PATHS = ['/api/v2/auth/login', '/api/v2/auth/refresh']
const MAX_BODY = 30 * 1024 * 1024

const BASE_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  referer: 'https://journal.top-academy.ru/',
  origin: 'https://journal.top-academy.ru',
  'accept-encoding': 'identity',
}

// ── Allowlist хостов ─────────────────────────────────────────────────────────
// Render сам задаёт RENDER_EXTERNAL_HOSTNAME (например journal-react.onrender.com).
// Свой домен добавьте через PROXY_EXTRA_HOSTS="journal.example.com,другой.домен"
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
if (process.env.RENDER_EXTERNAL_HOSTNAME) ALLOWED_HOSTS.add(process.env.RENDER_EXTERNAL_HOSTNAME.toLowerCase())
for (const h of (process.env.PROXY_EXTRA_HOSTS || '').split(',')) {
  if (h.trim()) ALLOWED_HOSTS.add(h.trim().toLowerCase())
}

function hostOnly(rawHost) {
  if (!rawHost) return ''
  const host = String(rawHost).trim().toLowerCase()
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end === -1 ? host : host.slice(0, end + 1)
  }
  return host.split(':')[0]
}

/** Запрос должен идти с нашего же сайта (а не с чужой страницы) */
function originOk(req) {
  const origin = req.headers.origin
  if (origin) {
    try { return ALLOWED_HOSTS.has(hostOnly(new URL(origin).host)) } catch { return false }
  }
  const site = req.headers['sec-fetch-site']
  return !site || site === 'same-origin' || site === 'none'
}

// ── Лимиты запросов (на IP) ──────────────────────────────────────────────────
const buckets = new Map()
function rateLimited(key, limit, windowMs) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now - b.start > windowMs) { buckets.set(key, { start: now, n: 1 }); return false }
  b.n++
  return b.n > limit
}
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (now - b.start > 120000) buckets.delete(k)
}, 60000).unref()

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  return (xff ? String(xff).split(',')[0].trim() : req.socket.remoteAddress) || 'unknown'
}

// ── Пароль на сайт (необязательно) ───────────────────────────────────────────
const sha = (s) => crypto.createHash('sha256').update(s).digest()
const GATE_TOKEN = SITE_PASSWORD ? sha('journal-gate:' + SITE_PASSWORD).toString('hex') : ''
const safeEq = (a, b) => {
  const ha = sha(String(a)), hb = sha(String(b))
  return crypto.timingSafeEqual(ha, hb)
}

function getCookie(req, name) {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return ''
}

/** true — пускаем; false — ответ уже отправлен */
function authorize(req, res, url) {
  if (!SITE_PASSWORD) return true
  if (safeEq(getCookie(req, 'gate'), GATE_TOKEN)) return true

  const isApi = url.pathname.startsWith('/api/')
  if (!isApi) {
    const m = /^Basic (.+)$/i.exec(req.headers.authorization || '')
    if (m) {
      const decoded = Buffer.from(m[1], 'base64').toString('utf8')
      const pass = decoded.slice(decoded.indexOf(':') + 1)
      if (safeEq(pass, SITE_PASSWORD)) {
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
        res.setHeader('Set-Cookie', `gate=${GATE_TOKEN}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}`)
        return true
      }
    }
    res.statusCode = 401
    res.setHeader('WWW-Authenticate', 'Basic realm="Journal", charset="UTF-8"')
    res.end('Authentication required')
    return false
  }
  res.statusCode = 403
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ message: 'Access denied' }))
  return false
}

// ── Запросы к API: HTTP/2 и HTTP/1.1 (как в vite.config.js) ──────────────────
function h2Request(method, p, headers, body) {
  return new Promise((resolve, reject) => {
    let settled = false
    const session = http2.connect(`https://${MSAPI_HOST}`)
    const finish = (fn, arg) => {
      if (!settled) { settled = true; fn(arg) }
      try { session.close() } catch { /* noop */ }
    }
    session.on('error', (e) => finish(reject, e))
    const req = session.request({ ':method': method, ':path': p, ...headers })
    req.setTimeout(45000, () => finish(reject, new Error('upstream timeout')))
    const raw = []
    let size = 0
    req.on('data', (c) => { size += c.length; if (size < MAX_BODY) raw.push(c) })
    req.on('response', (h) => {
      req.on('end', () => finish(resolve, {
        status: h[':status'] || 500,
        contentType: h['content-type'] || 'application/json',
        body: Buffer.concat(raw),
      }))
    })
    req.on('error', (e) => finish(reject, e))
    if (body) req.write(body)
    req.end()
  })
}

function h1Request(method, p, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: MSAPI_HOST, path: p, method, headers, timeout: 45000 },
      (res) => {
        const raw = []
        res.on('data', (c) => raw.push(c))
        res.on('end', () => resolve({
          status: res.statusCode || 500,
          contentType: res.headers['content-type'] || 'application/json',
          body: Buffer.concat(raw),
        }))
      }
    )
    req.on('timeout', () => req.destroy(new Error('upstream timeout')))
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

async function forward(method, p, reqHeaders, body) {
  const h1First = H1_PATHS.some((x) => p.startsWith(x))
  const transports = h1First ? [h1Request, h2Request] : [h2Request, h1Request]
  let last = null
  for (let i = 0; i < transports.length; i++) {
    try {
      const r = await transports[i](method, p, reqHeaders, body)
      const blockedLike =
        r.status === 403 || r.status === 503 ||
        (r.status === 200 && r.body.length === 0 && method === 'POST' && i === 0)
      last = r
      if (!blockedLike) return r
    } catch (e) {
      last = {
        status: 502,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ message: 'Proxy transport error: ' + e.message })),
      }
    }
  }
  return last
}

function sendJson(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BODY) throw Object.assign(new Error('too large'), { code: 413 })
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}

async function handleApi(req, res, url) {
  if (!url.pathname.startsWith(PROXY_PREFIX)) return sendJson(res, 404, { message: 'Proxy: only /api/v2/* is allowed' })
  if (!originOk(req)) return sendJson(res, 403, { message: 'Proxy: origin not allowed' })

  const ip = clientIp(req)
  const isLogin = H1_PATHS.some((x) => url.pathname.startsWith(x))
  if (isLogin && rateLimited('login:' + ip, 15, 60000)) return sendJson(res, 429, { message: 'Too many login attempts' })
  if (rateLimited('api:' + ip, 600, 60000)) return sendJson(res, 429, { message: 'Too many requests' })

  let body
  try { body = await readBody(req) } catch (e) { return sendJson(res, e.code === 413 ? 413 : 400, { message: 'Bad body' }) }

  const headers = { ...BASE_HEADERS, accept: req.headers.accept || 'application/json, text/plain, */*' }
  for (const [k, v] of Object.entries(req.headers)) {
    const kl = k.toLowerCase()
    if (HOP_HEADERS.has(kl)) continue
    if (kl === 'authorization' || kl === 'accept-language' || kl === 'content-type') headers[kl] = v
  }
  if (body.length) headers['content-type'] = headers['content-type'] || 'application/json'

  try {
    const up = await forward(req.method, url.pathname + url.search, headers, body.length ? body : null)
    res.statusCode = up.status
    res.setHeader('Content-Type', up.contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.end(up.body)
  } catch (e) {
    sendJson(res, 502, { message: 'Proxy error: ' + e.message })
  }
}

// ── Статика ──────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map'])
const fileCache = new Map() // file -> { raw, gz }

function cacheControl(rel) {
  if (rel.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  if (rel === '/index.html' || rel === '/sw.js' || rel.endsWith('.webmanifest')) return 'no-cache'
  return 'public, max-age=3600'
}

async function serveFile(req, res, file, rel) {
  let entry = fileCache.get(file)
  if (!entry) {
    const raw = await fs.promises.readFile(file)
    const ext = path.extname(file).toLowerCase()
    entry = { raw, gz: COMPRESSIBLE.has(ext) && raw.length > 1024 ? zlib.gzipSync(raw, { level: 9 }) : null }
    fileCache.set(file, entry)
  }
  const ext = path.extname(file).toLowerCase()
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  res.setHeader('Cache-Control', cacheControl(rel))
  res.setHeader('Vary', 'Accept-Encoding')
  let out = entry.raw
  if (entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.setHeader('Content-Encoding', 'gzip')
    out = entry.gz
  }
  res.setHeader('Content-Length', out.length)
  res.statusCode = 200
  res.end(req.method === 'HEAD' ? undefined : out)
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname)
  if (rel.endsWith('/')) rel += 'index.html'
  const file = path.join(DIST, rel)
  if (!file.startsWith(DIST + path.sep) && file !== DIST) { res.statusCode = 403; return res.end('Forbidden') }

  try {
    const st = await fs.promises.stat(file)
    if (st.isFile()) return await serveFile(req, res, file, rel)
  } catch { /* не нашли — пойдём в фолбэк */ }

  // Для файлов с расширением (js/css/png…) — честный 404, для маршрутов SPA — index.html
  if (path.extname(rel)) { res.statusCode = 404; return res.end('Not found') }
  return serveFile(req, res, path.join(DIST, 'index.html'), '/index.html')
}

// ── Сервер ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')

    // Проверка живости для хостинга — без авторизации и проверки хоста
    if (url.pathname === '/healthz') { res.statusCode = 200; return res.end('ok') }

    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')

    if (!ALLOWED_HOSTS.has(hostOnly(req.headers.host))) {
      res.statusCode = 403
      return res.end('Host not allowed. Add it to PROXY_EXTRA_HOSTS.')
    }
    if (!authorize(req, res, url)) return

    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url)

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end('Method not allowed') }
    return await serveStatic(req, res, url)
  } catch (e) {
    console.error('Unhandled error:', e)
    if (!res.headersSent) res.statusCode = 500
    res.end('Internal error')
  }
})

// Больше таймаута балансировщика Render (60 с) — иначе случайные 502
server.keepAliveTimeout = 65000
server.headersTimeout = 66000

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('⚠️  Папка dist не найдена. Сначала выполните: npm run build')
}
server.listen(PORT, LISTEN_HOST, () => {
  console.log(`Journal server: http://localhost:${PORT}  (hosts: ${[...ALLOWED_HOSTS].join(', ')})`)
  if (SITE_PASSWORD) console.log('Защита паролем: включена')
})

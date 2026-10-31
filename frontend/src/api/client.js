import { API_BASE, TOKENS_KEY } from './constants'

// ── Хранилище токенов ────────────────────────────────────────────────────────
let tokens = null
try {
  tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null')
} catch { tokens = null }

let onLogout = null
export function setOnLogout(fn) { onLogout = fn }

export function getTokens() { return tokens }

export function setTokens(next) {
  tokens = next
  if (next) localStorage.setItem(TOKENS_KEY, JSON.stringify(next))
  else localStorage.removeItem(TOKENS_KEY)
}

export class ApiError extends Error {
  constructor(status, payload) {
    super(extractMessage(payload, status))
    this.status = status
    this.payload = payload
  }
}

function extractMessage(payload, status) {
  if (Array.isArray(payload) && payload[0]?.message) return payload[0].message
  if (payload?.message) return payload.message
  if (typeof payload === 'string' && payload && payload.length < 200) return payload
  return `Ошибка API (${status})`
}

// ── Базовый запрос ───────────────────────────────────────────────────────────
let langProvider = () => 'ru_RU, ru'
export function setLangProvider(fn) { langProvider = fn }

async function rawRequest(path, { method = 'GET', body, params, signal } = {}) {
  let url = API_BASE + path
  if (params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
    }
    const s = qs.toString()
    if (s) url += `?${s}`
  }

  const headers = { Accept: 'application/json, text/plain, */*' }
  const lang = langProvider()
  if (lang) headers['Accept-Language'] = lang
  if (tokens?.access_token) headers['Authorization'] = `Bearer ${tokens.access_token}`

  // FormData отправляем как есть — браузер сам поставит multipart-заголовок
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    signal,
    body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined,
  })

  if (res.status === 204) return null
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }

  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

// ── Обновление токена (однопоточное) ────────────────────────────────────────
let refreshPromise = null

async function doRefresh() {
  if (!tokens?.refresh_token) throw new ApiError(401, null)
  // refresh идёт с тем же access-токеном в заголовке — прокси сам выберет h1-транспорт
  const data = await rawRequest('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: tokens.refresh_token },
  })
  setTokens(data)
  return data
}

async function request(path, options) {
  try {
    return await rawRequest(path, options)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && tokens?.refresh_token) {
      if (!refreshPromise) {
        refreshPromise = doRefresh()
          .catch((err) => {
            setTokens(null)
            onLogout?.()
            throw err
          })
          .finally(() => { refreshPromise = null })
      }
      await refreshPromise
      return rawRequest(path, options)
    }
    throw e
  }
}

export default request

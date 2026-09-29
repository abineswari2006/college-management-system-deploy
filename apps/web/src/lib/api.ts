export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'
let csrfToken = ''
let csrfRequest: Promise<string> | null = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  csrfRequest ??= fetch(`${apiBase}/auth/csrf`, { credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) throw new ApiError('Unable to establish a secure session.', response.status)
      const result = await response.json() as { data: { token: string } }
      csrfToken = result.data.token
      return csrfToken
    })
    .finally(() => { csrfRequest = null })
  return csrfRequest
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; collegeId?: string | null } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers()
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.collegeId) headers.set('X-College-Id', options.collegeId)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    headers.set('X-CSRF-Token', await getCsrfToken())
  }

  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('The service could not be reached. Check your connection and try again.', 0)
  }

  const result = await response.json().catch(() => null) as { message?: string | string[] } | null
  if (!response.ok) {
    if (response.status === 403 && typeof result?.message === 'string' && result.message.includes('CSRF')) {
      csrfToken = ''
    }
    const message = Array.isArray(result?.message)
      ? result.message.join(' ')
      : result?.message ?? 'Something went wrong. Please try again.'
    throw new ApiError(message, response.status)
  }
  return result as T
}

export function clearCsrfToken() {
  csrfToken = ''
}
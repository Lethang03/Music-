/**
 * Friendly Error Mapping Utility.
 * Translates backend, Supabase quota, network, and storage errors into clear,
 * actionable, and user-friendly messages without exposing raw technical strings.
 */

export function toFriendlyError(error, defaultMessage = 'An unexpected error occurred. Please try again.') {
  if (!error) return ''

  const message = typeof error === 'string' 
    ? error 
    : (error?.message || error?.error_description || error?.details || '')

  const status = Number(error?.status || error?.statusCode || 0)
  const code = String(error?.code || '')
  const combined = `${message} ${error?.details || ''} ${code}`.toLowerCase()

  // 1. Quota & Egress Limit Exceeded (HTTP 402 or Supabase restriction)
  if (
    status === 402 ||
    combined.includes('exceed_cached_egress_quota') ||
    combined.includes('quota') ||
    combined.includes('restricted due to') ||
    combined.includes('payment required') ||
    combined.includes('bandwidth limit')
  ) {
    return 'SoundVerse bandwidth quota is temporarily limited. Please try again shortly.'
  }

  // 2. Rate Limiting (HTTP 429)
  if (status === 429 || combined.includes('too many requests') || combined.includes('rate limit')) {
    return 'Too many requests. Please wait a moment before retrying.'
  }

  // 3. Network & Connection Failures
  if (
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('load failed') ||
    combined.includes('connection error') ||
    combined.includes('econnrefused') ||
    combined.includes('offline')
  ) {
    return 'Unable to connect to the server. Check your connection or retry.'
  }

  // 4. Storage & Service Unavailable (HTTP 502, 503, 504)
  if (
    status === 502 || status === 503 || status === 504 ||
    combined.includes('service unavailable') ||
    combined.includes('storage unavailable') ||
    combined.includes('bad gateway') ||
    combined.includes('gateway timeout')
  ) {
    return 'Storage service is temporarily unavailable. Please retry in a moment.'
  }

  // 5. Auth & Permission Failures
  if (
    status === 401 ||
    combined.includes('jwt expired') ||
    combined.includes('invalid refresh token') ||
    combined.includes('session is invalid')
  ) {
    return 'Your session has expired. Please sign in again.'
  }

  if (status === 403 || combined.includes('permission denied') || code === '42501') {
    return 'You do not have permission to perform this action.'
  }

  // If the error message is already short, friendly, and non-technical, return it
  if (
    message &&
    !message.includes('PGRST') &&
    !message.includes('supabase') &&
    !message.includes('postgres') &&
    !message.includes('SELECT') &&
    !message.includes('INSERT') &&
    !message.includes('column') &&
    message.length < 120
  ) {
    return message
  }

  return defaultMessage
}


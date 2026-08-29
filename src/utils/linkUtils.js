// URL handling for the links page. Addresses arrive pasted from a phone, where
// the scheme is usually missing and the host is the only part worth reading.

/** Adds https:// to a bare host, so what we store is always something a browser
 *  can open. mailto:, tel: and other complete addresses are left alone. */
export const normalizeUrl = (raw) => {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value
  return `https://${value}`
}

/** The part of an address worth showing at a glance — "youtube.com", not the
 *  sixty characters of tracking parameters trailing behind it. */
export const hostLabel = (url) => {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, '') || raw
  } catch {
    return raw
  }
}

/** Whether the address is complete enough for a browser to go somewhere with
 *  it. Guards the save button so a typo is caught while the form is still open
 *  rather than by whoever taps the dead link next Sunday. */
export const isOpenableUrl = (url) => {
  const value = normalizeUrl(url)
  if (!value) return false
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
      return value.length > parsed.protocol.length
    }
    return parsed.hostname.includes('.')
  } catch {
    return false
  }
}

/** The site's own icon, which says where a link goes faster than any label can.
 *  Resolved through Google so we don't have to fetch and parse each page
 *  ourselves; callers fall back to a drawn icon when it fails to load, which it
 *  will offline and for hosts that publish none. */
export const faviconUrl = (url, size = 64) => {
  const host = hostLabel(url)
  if (!host.includes('.')) return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`
}

/** Writes to the clipboard, resolving false instead of throwing when the
 *  browser blocks it (insecure context, denied permission). */
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

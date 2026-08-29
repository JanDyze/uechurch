// Helpers shared by the song list, the embedded player and the lineup: reading
// a video id out of whatever YouTube link someone pasted, and turning stored
// lyrics into the plain block the tech team pastes into the projector slides.

// watch?v=, youtu.be/, /embed/, /shorts/ and /live/ all appear in links people
// paste from a phone, so all five are accepted.
const YOUTUBE_ID_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export const getYoutubeId = (url) => {
  if (!url) return null
  const match = String(url).match(YOUTUBE_ID_PATTERN)
  return match ? match[1] : null
}

export const getYoutubeThumbnail = (url) => {
  const id = getYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

/** Thumbnail for an id that has already been extracted. */
export const thumbnailForId = (videoId) =>
  videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null

/** Lyrics exactly as they were typed — every line break is a slide break to
 *  whoever is building the projector deck, so nothing here reflows them. */
export const songLyricsText = (song) =>
  String(song?.lyrics || '').replace(/\r\n/g, '\n').trim()

export const hasLyrics = (song) => songLyricsText(song).length > 0

/**
 * One service's worth of lyrics, in order, ready to paste in one go.
 * Each song is headed by its number, title and key so the person building the
 * slides can see where a song starts without switching back to the app.
 *
 * @param {Array<{title: string, key?: string, lyrics?: string}>} entries
 * @param {string} heading Optional first line, e.g. the service date.
 */
export const formatLyricsSheet = (entries = [], heading = '') => {
  const blocks = entries.map((entry, index) => {
    const title = entry.key ? `${entry.title} (${entry.key})` : entry.title
    const body = songLyricsText(entry)
    return `${index + 1}. ${title}\n\n${body || '[no lyrics saved yet]'}`
  })
  const sheet = blocks.join('\n\n———\n\n')
  return heading ? `${heading}\n\n${sheet}` : sheet
}

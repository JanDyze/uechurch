/**
 * Gallery photo storage.
 *
 * Photographs used to live inside their own Firestore documents as base64
 * strings. That capped every picture at the 1 MiB a document holds, inflated
 * the bytes by a third, and put a Firestore read and a function decode in
 * front of every image the browser asked for — a cold gallery photo took two
 * seconds to arrive. They live in Vercel Blob now and are served from its CDN,
 * so the app hands out a URL and gets out of the way.
 *
 * This route is the only thing holding the store's credentials, which is why
 * the browser cannot upload straight to Blob: it posts here instead.
 *
 * Auth is `requireUser` rather than `requireAdmin` — the same gate
 * /api/song-lookup uses. Who may add a photograph is decided in the client by
 * the gallery capability; the job here is to keep anonymous traffic from
 * filling the store.
 *
 *   POST   /api/blob   { dataUrl, folder }   -> { url }
 *   DELETE /api/blob   { urls: [...] }       -> { deleted }
 */
import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { blobAuth } from "../lib/blobAuth.js";
import { requireUser } from "../lib/firebaseAdmin.js";

// Comfortably above anything the browser compressor produces, and far below
// the 100 MB a function will accept — a picture this big is a mistake, not a
// photograph.
const MAX_BYTES = 12 * 1024 * 1024;

const EXTENSIONS = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

/** `data:image/webp;base64,...` -> the bytes and what they are. */
const decodeDataUrl = (value) => {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(String(value || ""));
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
};

/**
 * Where in the store a file goes, sanitised.
 *
 * One or two plain segments, nothing else — so a caller can ask for
 * "members" or "gallery/<albumId>" but cannot steer a write out of the shape
 * this route intends. This used to hardcode a "gallery/" prefix and take only
 * the album id, which quietly filed every member portrait under
 * gallery/members/ and made the store read as though avatars were an album.
 */
const safeFolder = (value) =>
  String(value || "")
    .split("/")
    .map((part) => part.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64))
    .filter(Boolean)
    .slice(0, 2)
    .join("/") || "misc";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const caller = await requireUser(req);
  if (caller.error) return res.status(caller.status).json({ error: caller.error });

  // A JSON body on a DELETE is parsed for us by Vercel and by the dev
  // middleware, but it is the one request shape runtimes disagree about — so a
  // body that arrives as text is read here rather than assumed to have been
  // read already. Cheap insurance on a path whose failure mode is silent: an
  // unparsed body would look like "no URLs", and the route would happily
  // report success having deleted nothing.
  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Could not read that request" });
    }
  }

  try {
    if (req.method === "DELETE") {
      // An album takes its photographs with it, so this arrives as a list.
      // `del` is idempotent: a URL already gone is not an error, which is what
      // makes a half-finished delete safe to run again.
      const urls = (body.urls || []).filter(
        (url) => typeof url === "string" && url.startsWith("https://")
      );
      if (!urls.length) return res.status(200).json({ deleted: 0 });

      await del(urls, blobAuth());
      return res.status(200).json({ deleted: urls.length });
    }

    const decoded = decodeDataUrl(body.dataUrl);
    if (!decoded) return res.status(400).json({ error: "Expected a base64 image data URL" });

    const extension = EXTENSIONS[decoded.mime];
    if (!extension) return res.status(415).json({ error: `Unsupported image type ${decoded.mime}` });
    if (decoded.buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: "That image is too large" });
    }

    // Named with a fresh uuid rather than the uploader's filename: two people
    // photographing the same Sunday both arrive with IMG_0001.jpg.
    const folder = safeFolder(body.folder);
    const blob = await put(`${folder}/${randomUUID()}.${extension}`, decoded.buffer, {
      access: "public",
      contentType: decoded.mime,
      ...blobAuth(),
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error("Error talking to Blob storage:", error);
    // The store's credentials are an OIDC token that expires within hours, and
    // locally it is only as fresh as the last `vercel env pull`. That is the
    // failure somebody will actually hit, so it is worth naming.
    const denied = /oidc|token|credential|access denied/i.test(String(error?.message || ""));
    return res.status(denied ? 401 : 500).json({
      error: denied
        ? "The image store refused these credentials. Run `vercel env pull .env.local`."
        : "Could not store that image",
    });
  }
}

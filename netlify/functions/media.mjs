import { CHUNK, ID_RE, chunkKey, docKey, mediaKey, mediaStore, messagesStore } from "../lib/common.mjs";

const notFound = () => new Response("Nenalezeno", { status: 404, headers: { "Cache-Control": "no-store" } });

// URLs carry ?v=<updatedAt>, so a given URL always points at the same content.
const CACHE = "public, max-age=31536000, immutable";

async function serveImage(id, kind) {
  const res = await mediaStore().getWithMetadata(mediaKey(id, kind), { type: "arrayBuffer" });
  if (!res) return notFound();
  const type = res.metadata?.type === "image/png" ? "image/png" : "image/jpeg";
  return new Response(res.data, {
    headers: { "Content-Type": type, "Cache-Control": CACHE, "X-Content-Type-Options": "nosniff" },
  });
}

// Videos are stored in 4 MB parts and served with HTTP range requests, at most one part per response.
async function serveVideo(req, video) {
  const size = video.size;
  let start = 0;
  let end = size - 1;
  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(end, Number(m[2]));
    }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
  }
  const part = Math.floor(start / CHUNK);
  const partStart = part * CHUNK;
  end = Math.min(end, partStart + CHUNK - 1);

  const data = await mediaStore().get(chunkKey(video.upload, part), { type: "arrayBuffer" });
  if (!data) return notFound();
  const body = data.slice(start - partStart, end - partStart + 1);
  const headers = {
    "Content-Type": video.type,
    "Accept-Ranges": "bytes",
    "Cache-Control": CACHE,
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(body.byteLength),
  };
  if (!range && end === size - 1) return new Response(body, { headers });
  headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  return new Response(body, { status: 206, headers });
}

export default async (req, context) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
  const { id, kind } = context.params;
  if (!ID_RE.test(id || "")) return notFound();
  if (kind === "kresba" || kind === "obrazek") return serveImage(id, kind);
  if (kind !== "video") return notFound();
  const doc = await messagesStore().get(docKey(id), { type: "json" });
  if (!doc || !doc.video) return notFound();
  return serveVideo(req, doc.video);
};

export const config = { path: "/api/media/:id/:kind" };

import {
  CHUNK, COLOR_COUNT, ID_RE, IMG_LIMIT, MAX_CHUNKS, NAME_MAX, TEXT_MAX, UPLOAD_RE, VIDEO_LIMIT, VIDEO_TYPES,
  chunkKey, deleteVideoChunks, docKey, fail, hashToken, isAdminPass, isWritePass, json, loadAll,
  mediaKey, mediaStore, messagesStore, publicDoc, randomHex, tokenMatches,
} from "../lib/common.mjs";

const DATA_URL_RE = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/;

class HttpError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

/** Decodes and checks an image data URL from the page. */
function parseImage(value) {
  if (typeof value !== "string") throw new HttpError("obrazek", 400);
  if (value.length > IMG_LIMIT) throw new HttpError("velikost", 413);
  const m = DATA_URL_RE.exec(value);
  if (!m) throw new HttpError("obrazek", 400);
  const bytes = Buffer.from(m[2], "base64");
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((m[1] === "image/png" && !isPng) || (m[1] === "image/jpeg" && !isJpeg)) throw new HttpError("obrazek", 400);
  return { type: m[1], bytes };
}

/** Checks that every part of an uploaded video is present and returns its description. */
async function checkVideo(value) {
  if (!value || typeof value !== "object" || !UPLOAD_RE.test(value.upload || "") || !VIDEO_TYPES.includes(value.type)) {
    throw new HttpError("video", 400);
  }
  const store = mediaStore();
  const sizes = [];
  for (let n = 0; n < MAX_CHUNKS; n++) {
    const meta = await store.getMetadata(chunkKey(value.upload, n));
    if (!meta) break;
    sizes.push(Number(meta.metadata?.size) || 0);
  }
  if (!sizes.length) throw new HttpError("video", 400);
  // All parts but the last must be full, so a byte offset maps straight to its part.
  const last = sizes.length - 1;
  if (sizes.some((s, i) => s <= 0 || s > CHUNK || (i < last && s !== CHUNK))) throw new HttpError("video", 400);
  const size = sizes.reduce((a, b) => a + b, 0);
  if (size > VIDEO_LIMIT) throw new HttpError("velikost", 413);
  return { upload: value.upload, type: value.type, size, parts: sizes.length };
}

function pickColor(docs) {
  const used = new Array(COLOR_COUNT).fill(0);
  docs.forEach((d) => { if (Number.isInteger(d.barva) && d.barva >= 0 && d.barva < COLOR_COUNT) used[d.barva]++; });
  const min = Math.min(...used);
  const free = used.map((c, i) => (c === min ? i : -1)).filter((i) => i >= 0);
  return free[Math.floor(Math.random() * free.length)];
}

async function save(body) {
  if (!isWritePass(body.heslo)) throw new HttpError("heslo", 401);

  const jmeno = typeof body.jmeno === "string" ? body.jmeno.trim().slice(0, NAME_MAX) : "";
  if (!jmeno) throw new HttpError("jmeno", 400);
  const text = typeof body.text === "string" ? body.text.trim().slice(0, TEXT_MAX) : "";

  const store = messagesStore();
  const media = mediaStore();
  const isNew = body.id === undefined || body.id === null;
  let prev = null;
  if (!isNew) {
    if (typeof body.id !== "string" || !ID_RE.test(body.id)) throw new HttpError("nenalezeno", 404);
    prev = await store.get(docKey(body.id), { type: "json" });
    if (!prev) throw new HttpError("nenalezeno", 404);
    if (!tokenMatches(body.token, prev.tokenHash)) throw new HttpError("token", 403);
  }

  // Work out the new state of each attachment before writing anything.
  const keepKresba = body.kresba === "keep" && !!prev?.kresba;
  const newKresba = body.kresba && body.kresba !== "keep" ? parseImage(body.kresba) : null;
  const keepObrazek = body.obrazek === "keep" && !!prev?.obrazek;
  const newObrazek = body.obrazek && body.obrazek !== "keep" ? parseImage(body.obrazek) : null;
  if (newObrazek && newObrazek.type !== "image/jpeg") throw new HttpError("obrazek", 400);
  const keepVideo = body.video === "keep" && !!prev?.video;
  const newVideo = body.video && body.video !== "keep" ? await checkVideo(body.video) : null;

  const kresba = keepKresba || !!newKresba;
  const obrazek = keepObrazek || !!newObrazek;
  const video = newVideo || (keepVideo ? prev.video : null);
  if (!text && !kresba && !obrazek && !video) throw new HttpError("prazdny", 400);

  const id = prev ? prev.id : randomHex(8);
  const token = prev ? null : randomHex(16);
  const now = new Date().toISOString();

  if (newKresba) await media.set(mediaKey(id, "kresba"), newKresba.bytes, { metadata: { type: newKresba.type } });
  if (newObrazek) await media.set(mediaKey(id, "obrazek"), newObrazek.bytes, { metadata: { type: newObrazek.type } });

  const doc = {
    id,
    jmeno,
    barva: prev ? prev.barva : pickColor(await loadAll()),
    text,
    kresba,
    obrazek,
    video,
    createdAt: prev ? prev.createdAt : now,
    updatedAt: now,
    tokenHash: prev ? prev.tokenHash : hashToken(token),
  };
  await store.setJSON(docKey(id), doc);

  // Clean up attachments that were removed or replaced.
  if (prev?.kresba && !kresba) await media.delete(mediaKey(id, "kresba"));
  if (prev?.obrazek && !obrazek) await media.delete(mediaKey(id, "obrazek"));
  if (prev?.video && prev.video.upload !== video?.upload) await deleteVideoChunks(prev.video);

  return json(token ? { vzkaz: publicDoc(doc), token } : { vzkaz: publicDoc(doc) });
}

async function remove(body) {
  const id = typeof body.id === "string" && ID_RE.test(body.id) ? body.id : null;
  const useAdmin = body.sprava !== undefined && body.sprava !== null;
  if (useAdmin && !isAdminPass(body.sprava)) throw new HttpError("token", 403);
  if (!id) throw new HttpError("nenalezeno", 404);

  const store = messagesStore();
  const doc = await store.get(docKey(id), { type: "json" });
  if (!doc) throw new HttpError("nenalezeno", 404);
  if (!useAdmin && !tokenMatches(body.token, doc.tokenHash)) throw new HttpError("token", 403);

  await store.delete(docKey(id));
  const media = mediaStore();
  await Promise.all([media.delete(mediaKey(id, "kresba")), media.delete(mediaKey(id, "obrazek"))]);
  await deleteVideoChunks(doc.video);
  return json({ ok: true });
}

export default async (req) => {
  try {
    if (req.method === "GET") {
      const docs = await loadAll();
      return json({ vzkazy: docs.map(publicDoc) });
    }
    if (req.method !== "POST") return fail("metoda", 405);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("pozadavek", 400);
    return body.akce === "smazat" ? await remove(body) : await save(body);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.code, e.status);
    console.error(e);
    return fail("server", 500);
  }
};

export const config = { path: "/api/vzkazy" };

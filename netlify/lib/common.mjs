import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Default passwords; can be overridden with the HESLO_PSANI / HESLO_SPRAVA environment variables.
const DEFAULT_WRITE_PASS = "30";
const DEFAULT_ADMIN_PASS = "narozeniny rodeo";

export const COLOR_COUNT = 13;
export const NAME_MAX = 40;
export const TEXT_MAX = 5000;
export const IMG_LIMIT = 1_000_000; // max length of a data URL (client keeps it under 900 000)
export const CHUNK = 4 * 1024 * 1024; // video upload chunk size, must match the page
export const VIDEO_LIMIT = 30 * 1024 * 1024;
export const MAX_CHUNKS = Math.ceil(VIDEO_LIMIT / CHUNK);
export const VIDEO_TYPES = ["video/mp4", "video/webm"];

export const ID_RE = /^[a-f0-9]{16}$/;
export const UPLOAD_RE = /^[a-f0-9]{24}$/;

export const messagesStore = () => getStore({ name: "vzkazy", consistency: "strong" });
export const mediaStore = () => getStore({ name: "media", consistency: "strong" });

export const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (code, status) => json({ chyba: code }, status);

const normalize = (s) => (typeof s === "string" ? s.toLowerCase().replace(/\s+/g, "") : "");
const sha256 = (s) => createHash("sha256").update(s).digest();

function safeEqual(a, b) {
  const ha = sha256(a);
  const hb = sha256(b);
  return timingSafeEqual(ha, hb);
}

function checkPass(given, envName, fallback) {
  const expected = normalize(Netlify.env.get(envName) || fallback);
  const value = normalize(given);
  return value.length > 0 && safeEqual(value, expected);
}

export const isWritePass = (p) => checkPass(p, "HESLO_PSANI", DEFAULT_WRITE_PASS);
export const isAdminPass = (p) => checkPass(p, "HESLO_SPRAVA", DEFAULT_ADMIN_PASS);

export const randomHex = (bytes) => randomBytes(bytes).toString("hex");
export const hashToken = (token) => sha256(String(token)).toString("hex");
export function tokenMatches(token, hash) {
  if (typeof token !== "string" || !token || typeof hash !== "string") return false;
  return safeEqual(hashToken(token), hash);
}

export const docKey = (id) => `vzkaz/${id}`;
export const mediaKey = (id, kind) => `${id}/${kind}`;
export const chunkKey = (upload, n) => `video/${upload}/${n}`;

/** Strips server-only fields before sending a message to the browser. */
export function publicDoc(d) {
  return {
    id: d.id,
    jmeno: d.jmeno,
    barva: d.barva,
    text: d.text,
    kresba: !!d.kresba,
    obrazek: !!d.obrazek,
    video: d.video ? { type: d.video.type } : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function loadAll() {
  const store = messagesStore();
  const { blobs } = await store.list({ prefix: "vzkaz/" });
  const docs = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return docs.filter(Boolean);
}

export async function deleteVideoChunks(video) {
  if (!video || !video.upload) return;
  const store = mediaStore();
  await Promise.all(
    Array.from({ length: video.parts || 0 }, (_, n) => store.delete(chunkKey(video.upload, n)))
  );
}

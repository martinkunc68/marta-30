import { CHUNK, MAX_CHUNKS, UPLOAD_RE, chunkKey, fail, isWritePass, json, mediaStore } from "../lib/common.mjs";

// Receives one part of a video. The page sends parts of 4 MB; they are joined when the message is saved.
export default async (req) => {
  if (req.method !== "POST") return fail("metoda", 405);
  let pass = "";
  try { pass = decodeURIComponent(req.headers.get("x-heslo") || ""); } catch { pass = ""; }
  if (!isWritePass(pass)) return fail("heslo", 401);

  const url = new URL(req.url);
  const u = url.searchParams.get("u") || "";
  const n = Number(url.searchParams.get("n"));
  if (!UPLOAD_RE.test(u) || !Number.isInteger(n) || n < 0 || n >= MAX_CHUNKS) return fail("video", 400);

  const data = await req.arrayBuffer();
  if (data.byteLength === 0) return fail("video", 400);
  if (data.byteLength > CHUNK) return fail("velikost", 413);

  await mediaStore().set(chunkKey(u, n), data, { metadata: { size: String(data.byteLength) } });
  return json({ ok: true });
};

export const config = { path: "/api/upload" };

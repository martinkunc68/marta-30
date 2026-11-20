import { fail, isAdminPass, isWritePass, json } from "../lib/common.mjs";

// Checks the write password ("psani") or the management password ("sprava").
export default async (req) => {
  if (req.method !== "POST") return fail("metoda", 405);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("pozadavek", 400);
  const ok = body.typ === "sprava" ? isAdminPass(body.heslo) : body.typ === "psani" ? isWritePass(body.heslo) : false;
  return ok ? json({ ok: true }) : fail("heslo", 401);
};

export const config = { path: "/api/overit" };

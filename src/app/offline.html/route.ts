import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiUser } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The rescue copy includes the answer key, so only signed-in hosts may download it. */
export async function GET() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const html = await readFile(path.join(process.cwd(), "scripts/cox-data/offline.html"), "utf8");
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": 'attachment; filename="plant-pathology-offline.html"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

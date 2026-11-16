import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/server/session";
import { canEditBoard } from "@/server/access";
import { prisma } from "@/server/db";
import { getManager } from "@/server/live";
import { coxAnswerRevealed, coxAsset } from "@/shared/coxMedia";
import { boardContentSchema } from "@/shared/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
const missing = () => new Response(null, { status: 404, headers });

export async function GET(req: Request, ctx: { params: Promise<{ asset: string }> }) {
  const { asset } = await ctx.params;
  if (!/^[a-f0-9]{48}\.png$/.test(asset)) return missing();
  const url = new URL(req.url);
  const gameId = url.searchParams.get("game"), clueId = url.searchParams.get("clue");
  let allowed = false;
  if (gameId && gameId.length <= 100 && clueId && clueId.length <= 40) {
    const live = await getManager().load(gameId);
    allowed = !!live && coxAnswerRevealed(live.state, clueId, asset);
  }
  if (!allowed) {
    const user = await currentUser();
    if (user) {
      const board = await prisma.board.findUnique({ where: { id: "cox-plant-pathology-2026" } });
      const parsed = board && boardContentSchema.safeParse(board.content);
      if (board && parsed?.success && await canEditBoard(user.id, board.ownerId)) {
        const answers = parsed.data.rounds.flatMap(r => r.categories.flatMap(c => c.clues.map(q => q.answerMedia)));
        allowed = [...answers, parsed.data.final?.answerMedia].some(m => coxAsset(m) === asset);
      }
    }
  }
  if (!allowed) return missing();
  try {
    const data = await readFile(path.join(process.cwd(), "private/cox-answer-media", asset));
    return new Response(new Uint8Array(data), { headers: { ...headers, "content-type": "image/png" } });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return missing();
    throw e;
  }
}

import type { GameView } from "@/engine/views";

/** Compatible with the original deck's standalone rescue file. No answer key is exported. */
export function classroomBackup(view: GameView, savedAt = new Date().toISOString()) {
  const count = Math.min(6, Math.max(2, view.settings.teamCount ?? view.teams.length));
  const teams = Array.from({ length: 6 }, (_, i) => {
    const team = view.teams[i];
    return { name: (team?.name ?? `Team ${i + 1}`).slice(0, 24), score: team ? (view.scores[team.id] ?? 0) : 0 };
  });
  const used = [...new Set(view.board?.categories.flatMap((c) => c.clues.filter((q) => q.used && /^cox-[0-4]-[0-4]$/.test(q.id)).map((q) => q.id.slice(4))) ?? [])];
  return {
    format: "cox-jeopardy-state",
    version: 1,
    deck: "PLSCI_30105010_JEOPARDY_2026",
    savedAt,
    source: { gameId: view.gameId, code: view.code, receivedVersion: view.version, serverNow: view.serverNow },
    state: { teams, count, used, daily: false, bonus: ["0-1", "0-2"], wagers: {}, attempts: {}, log: [] },
  };
}

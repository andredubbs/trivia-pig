import type { Media } from "./board";
import type { GameState } from "@/engine/types";
import { findClue } from "./board";

/** Only generated private Cox assets use this protocol; other upstream media is unchanged. */
export function coxAsset(media: Media | null | undefined): string | null {
  return media?.url.match(/^\/api\/cox-media\/([a-f0-9]{48}\.png)$/)?.[1] ?? null;
}

export function coxMediaForGame(media: Media | null | undefined, gameId: string | undefined, clueId: string): Media | null {
  if (!media) return null;
  return gameId && coxAsset(media)
    ? { ...media, url: `${media.url}?game=${encodeURIComponent(gameId)}&clue=${encodeURIComponent(clueId)}` }
    : media;
}

/** Re-evaluated on every request: guessing a URL or undoing a reveal cannot grant access. */
export function coxAnswerRevealed(state: GameState, clueId: string, asset: string): boolean {
  if (clueId === "final") {
    const final = state.final;
    return coxAsset(state.board.final?.answerMedia) === asset && !!final &&
      (final.stage === "done" || Object.values(final.revealed).some(r => r.judged === true));
  }
  return state.clue?.id === clueId && state.clue.stage === "revealed" &&
    coxAsset(findClue(state.board, clueId)?.clue.answerMedia) === asset;
}

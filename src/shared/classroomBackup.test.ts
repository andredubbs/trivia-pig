import { expect, it } from "vitest";
import { makeRound } from "./board";
import { initialState } from "@/engine/reducer";
import { DEFAULT_SETTINGS } from "@/engine/types";
import { buildView } from "@/engine/views";
import { classroomBackup } from "./classroomBackup";

it("exports team scores and played canonical IDs to the standalone rescue format without answers", () => {
  const round = makeRound("single", 1, [100, 200]);
  round.categories[0].clues[0] = { id: "cox-0-0", text: "question", answer: "private answer", dailyDouble: false };
  round.categories[0].clues[1] = { id: "cox-0-1", text: "next", answer: "next answer", dailyDouble: false };
  const state = initialState({ board: { rounds: [round] }, settings: { ...DEFAULT_SETTINGS, classroomTeams: true, teamCount: 2 } });
  state.phase = "board";
  state.used["cox-0-0"] = true;
  state.teams[0].name = "Leaf team";
  state.scores.classroom_1 = -100;
  state.scores.classroom_2 = 400;
  const backup = classroomBackup(buildView(state, { audience: "host", code: "LEAF", title: "Class", now: 123 }), "2026-11-15T00:00:00.000Z");
  expect(backup).toMatchObject({ format: "cox-jeopardy-state", version: 1, deck: "PLSCI_30105010_JEOPARDY_2026", state: { count: 2, used: ["0-0"], daily: false, bonus: ["0-1", "0-2"], wagers: {}, attempts: {}, log: [] } });
  expect(backup.state.teams).toHaveLength(6);
  expect(backup.state.teams[0]).toEqual({ name: "Leaf team", score: -100 });
  expect(backup.state.teams[1].score).toBe(400);
  expect(JSON.stringify(backup)).not.toContain("private answer");
});

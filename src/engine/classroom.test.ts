import { describe, expect, it } from "vitest";
import { makeRound } from "@/shared/board";
import { GameHistory } from "./history";
import { DEFAULT_SETTINGS, settingsSchema, type GameAction } from "./types";

function classroom() {
  const round = makeRound("single", 1, [100]);
  round.categories[0].clues[0].text = "Classroom test clue";
  round.categories[0].clues[0].answer = "Classroom test answer";
  const g = new GameHistory({ board: { rounds: [round] }, settings: { ...DEFAULT_SETTINGS, classroomTeams: true } });
  let at = 1000;
  const act = (action: GameAction) => g.dispatch(action, "host:test", ++at);
  const join = (playerId: string, teamId = "classroom_1") => act({ type: "player/join", playerId, teamId, name: playerId, signature: null });
  return { g, act, join };
}

describe("classroom team seats", () => {
  it("starts with six teams and permits only 2–6", () => {
    const { g, act } = classroom();
    expect(g.state.settings.mode).toBe("team");
    expect(g.state.teams).toHaveLength(6);
    expect(settingsSchema.safeParse({ teamCount: 1 }).success).toBe(false);
    expect(settingsSchema.safeParse({ teamCount: 7 }).success).toBe(false);
    expect(act({ type: "settings/update", settings: { teamCount: 2 } }).ok).toBe(true);
    expect(g.state.teams.map((t) => t.id)).toEqual(["classroom_1", "classroom_2"]);
  });

  it("rejects a second phone on a team and preserves a reconnect's score", () => {
    const { g, act, join } = classroom();
    expect(join("first").ok).toBe(true);
    act({ type: "score/adjust", contestantId: "classroom_1", delta: 300 });
    expect(join("second").ok).toBe(false);
    expect(join("unassigned", "missing").ok).toBe(false);
    expect(join("first").ok).toBe(true);
    expect(g.state.scores.classroom_1).toBe(300);
    act({ type: "player/kick", playerId: "first" });
    expect(join("replacement").ok).toBe(true);
    expect(g.state.scores.classroom_1).toBe(300);
    expect(act({ type: "player/restore", playerId: "first" }).ok).toBe(false);
  });

  it("cannot remove occupied slots, unassign phones, or escape classroom mode", () => {
    const { g, act, join } = classroom();
    join("sixth", "classroom_6");
    expect(act({ type: "settings/update", settings: { teamCount: 2 } }).ok).toBe(false);
    expect(act({ type: "team/assign", playerId: "sixth", teamId: null }).ok).toBe(false);
    expect(act({ type: "team/delete", teamId: "classroom_6" }).ok).toBe(false);
    act({ type: "settings/update", settings: { classroomTeams: false, mode: "solo" } });
    expect(g.state.settings.classroomTeams).toBe(true);
    expect(g.state.settings.mode).toBe("team");
    expect(g.state.teams).toHaveLength(6);
  });

  it("supports phone naming and host renaming without changing the team seat", () => {
    const { g, act, join } = classroom();
    join("Rust detectives");
    expect(g.state.teams[0].name).toBe("Rust detectives");
    act({ type: "team/rename", teamId: "classroom_1", name: "Leaf detectives" });
    expect(g.state.players["Rust detectives"].name).toBe("Leaf detectives");
    expect(g.state.players["Rust detectives"].teamId).toBe("classroom_1");
  });
});

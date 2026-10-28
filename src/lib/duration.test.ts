import { describe, expect, it } from "vitest";
import { durationParts } from "./duration";

describe("durationParts", () => {
  it("splits hours into days, hours and minutes", () => {
    expect(durationParts(0.4)).toEqual({ days: 0, hours: 0, minutes: 24 });
    expect(durationParts(1.5)).toEqual({ days: 0, hours: 1, minutes: 30 });
    expect(durationParts(3.8)).toEqual({ days: 0, hours: 3, minutes: 48 });
    expect(durationParts(26.25)).toEqual({ days: 1, hours: 2, minutes: 15 });
  });

  it("rounds to the nearest minute, carrying into hours", () => {
    expect(durationParts(1.9999)).toEqual({ days: 0, hours: 2, minutes: 0 });
    expect(durationParts(35 / 60)).toEqual({ days: 0, hours: 0, minutes: 35 });
  });
});

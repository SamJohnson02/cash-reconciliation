import { describe, expect, it } from "vitest";

import { calendarDateInZone, zonedLocalToUtc } from "./dates.js";

describe("Chicago cutoff clock", () => {
  it("places 4:00 PM Central on 6 November 2026 at 22:00 UTC", () => {
    const cutoff = zonedLocalToUtc("2026-11-06", "16:00", "America/Chicago");
    expect(cutoff.toISOString()).toBe("2026-11-06T22:00:00.000Z");
  });

  it("reads the Chicago calendar date from an instant", () => {
    expect(calendarDateInZone(new Date("2026-11-06T22:30:00.000Z"), "America/Chicago")).toBe("2026-11-06");
    expect(calendarDateInZone(new Date("2026-11-07T04:30:00.000Z"), "America/Chicago")).toBe("2026-11-06");
  });
});

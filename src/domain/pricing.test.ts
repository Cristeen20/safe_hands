import { describe, expect, it } from "vitest";
import type { RegionPricing } from "@/config/pricing";
import { haversineMeters, isTooClose, priceRoute, roundUpHours, type Leg, type PricingInput } from "./pricing";

const india: RegionPricing = {
  rates: { perDistance: 25_00, driveHour: 100_00, serviceHour: 500_00, driverMinimum: 400_00 },
};
const leg = (km: number, minutes: number, estimated = false): Leg => ({
  meters: km * 1000,
  seconds: minutes * 60,
  estimated,
});
const price = (input: Partial<PricingInput>, pricing = india) =>
  priceRoute(
    {
      serviceType: "hospital_visit",
      withVehicle: true,
      requestedHours: 4,
      multiDay: false,
      fromToTo: leg(12, 35),
      ...input,
    },
    pricing,
    "INR",
    "kilometer",
  );

describe("roundUpHours", () => {
  it("rounds up to the next half hour", () => {
    expect(roundUpHours(0.1)).toBe(0.5);
    expect(roundUpHours(1.5)).toBe(1.5);
    expect(roundUpHours(1.51)).toBe(2);
    expect(roundUpHours(2.0000000001)).toBe(2);
  });
});

describe("hospital visit", () => {
  it("with a vehicle, charges 25/km over the round trip, nothing for base → pickup, plus the service hours", () => {
    const est = price({ requestedHours: 2 });
    expect(est.outcome).toBe("auto");
    expect(est.tripDistance).toBe(24);
    expect(est.lines).toEqual([
      { kind: "distance", quantity: 24, rateMinor: 25_00, amountMinor: 600_00 },
      { kind: "serviceTime", quantity: 2, rateMinor: 500_00, amountMinor: 1000_00 },
    ]);
    expect(est.amountMinor).toBe(600_00 + 2 * 500_00);
  });

  it("prices long trips automatically: there's no distance limit", () => {
    expect(price({ requestedHours: 2, fromToTo: leg(40, 70) })).toMatchObject({ outcome: "auto", reasons: [] });
  });

  it("without a vehicle, charges round-trip drive hours plus the chosen service hours", () => {
    const est = price({ withVehicle: false, requestedHours: 2 });
    // 35 min each way = 70 min → 1.5 h billed.
    expect(est.billedHours).toBe(1.5);
    expect(est.amountMinor).toBe(1.5 * 100_00 + 2 * 500_00);
    expect(est.outcome).toBe("auto");
  });

  it("goes to an admin when the market has no rates", () => {
    expect(price({}, { rates: null })).toMatchObject({
      outcome: "pendingAdmin",
      reasons: ["noRates"],
      amountMinor: null,
    });
  });

  it("flags straight-line estimates for an admin, keeping the suggested price", () => {
    const est = price({ requestedHours: 1, fromToTo: leg(12, 24, true) });
    expect(est.outcome).toBe("pendingAdmin");
    expect(est.reasons).toEqual(["estimatedRoute"]);
    expect(est.amountMinor).toBe(600_00 + 500_00);
  });
});

describe("driver", () => {
  it("in our vehicle, charges 25/km over the one-way trip, with no hourly charge", () => {
    const est = price({ serviceType: "driver", withVehicle: true, fromToTo: leg(100, 5 * 60) });
    expect(est.lines).toEqual([{ kind: "distance", quantity: 100, rateMinor: 25_00, amountMinor: 2500_00 }]);
    expect(est.amountMinor).toBe(2500_00);
    expect(est.billedHours).toBeNull();
    expect(est.outcome).toBe("auto");
  });

  it("in our vehicle, never charges less than 400", () => {
    const est = price({ serviceType: "driver", withVehicle: true, fromToTo: leg(10, 20) });
    expect(est.lines).toEqual([{ kind: "minimum", quantity: 1, rateMinor: 400_00, amountMinor: 400_00 }]);
    expect(est.amountMinor).toBe(400_00);
  });

  it("in the customer's own car, charges a flat 400 whatever the distance", () => {
    expect(price({ serviceType: "driver", withVehicle: false, fromToTo: leg(380, 6 * 60) }).amountMinor).toBe(400_00);
  });

  it("sends multi-day trips to an admin", () => {
    expect(price({ serviceType: "driver", multiDay: true })).toMatchObject({
      outcome: "pendingAdmin",
      reasons: ["multiDay"],
      amountMinor: null,
    });
  });
});

describe("companion", () => {
  it("always goes to an admin with no price", () => {
    expect(price({ serviceType: "companion" })).toMatchObject({
      outcome: "pendingAdmin",
      reasons: ["companion"],
      amountMinor: null,
    });
  });
});

describe("distances", () => {
  it("measures straight-line distance and spots identical points", () => {
    const kochi = { lat: 9.9312, lng: 76.2673 };
    const aluva = { lat: 10.1004, lng: 76.3570 };
    expect(haversineMeters(kochi, aluva) / 1000).toBeCloseTo(21.2, 0);
    expect(isTooClose(kochi, { lat: 9.9313, lng: 76.2674 })).toBe(true);
    expect(isTooClose(kochi, aluva)).toBe(false);
  });

  it("reports distances in miles for mile markets", () => {
    const est = priceRoute(
      { serviceType: "driver", withVehicle: false, requestedHours: 4, multiDay: false, fromToTo: leg(16.09344, 30) },
      india,
      "GBP",
      "mile",
    );
    expect(est.tripDistance).toBe(10);
  });
});

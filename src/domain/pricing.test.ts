import { describe, expect, it } from "vitest";
import type { RegionPricing } from "@/config/pricing";
import { haversineMeters, isTooClose, priceRoute, roundUpHours, type Leg, type PricingInput } from "./pricing";

const india: RegionPricing = {
  driverBase: { lat: 9.9312, lng: 76.2673 },
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
      toToBase: null,
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
    expect(price({}, { driverBase: null, rates: null })).toMatchObject({
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
  const driver = (input: Partial<PricingInput>) => price({ serviceType: "driver", withVehicle: false, ...input });

  it("counts the drive back from the destination to our base", () => {
    const est = driver({ fromToTo: leg(100, 150), toToBase: leg(80, 120) });
    expect(est.tripDistance).toBe(180);
    expect(est.driveHours).toBe(4.5);
    expect(est.legs).toEqual([
      { kind: "outbound", distance: 100, driveHours: 2.5 },
      { kind: "return", distance: 80, driveHours: 2 },
    ]);
    expect(est.billedHours).toBe(4.5);
  });

  it("charges the 400 minimum for up to 4 hours of driving", () => {
    expect(driver({ fromToTo: leg(10, 20), toToBase: leg(10, 20) }).lines).toEqual([
      { kind: "minimum", quantity: 1, rateMinor: 400_00, amountMinor: 400_00 },
    ]);
    expect(driver({ fromToTo: leg(100, 120), toToBase: leg(100, 120) }).amountMinor).toBe(400_00);
  });

  it("charges 100/hr once the driving is over 4 hours, rounded up to the half hour", () => {
    const est = driver({ fromToTo: leg(120, 150), toToBase: leg(100, 100) });
    // 250 min → 4.5 h billed.
    expect(est.lines).toEqual([{ kind: "driveTime", quantity: 4.5, rateMinor: 100_00, amountMinor: 450_00 }]);
    expect(est.outcome).toBe("auto");
  });

  it("in our vehicle, adds 25/km over the same trip", () => {
    const est = driver({ withVehicle: true, fromToTo: leg(100, 150), toToBase: leg(80, 150) });
    expect(est.lines).toEqual([
      { kind: "driveTime", quantity: 5, rateMinor: 100_00, amountMinor: 500_00 },
      { kind: "distance", quantity: 180, rateMinor: 25_00, amountMinor: 4500_00 },
    ]);
    expect(est.amountMinor).toBe(5000_00);
  });

  it("in our vehicle, adds the distance on top of the minimum", () => {
    expect(driver({ withVehicle: true, fromToTo: leg(10, 20), toToBase: leg(6, 15) }).amountMinor).toBe(
      400_00 + 16 * 25_00,
    );
  });

  it("gives no price for more than 9 hours of driving, so an admin quotes it", () => {
    const est = driver({ withVehicle: true, fromToTo: leg(300, 5 * 60), toToBase: leg(250, 4 * 60 + 1) });
    expect(est).toMatchObject({ outcome: "pendingAdmin", reasons: ["tooLong"], amountMinor: null, lines: [] });
    expect(driver({ fromToTo: leg(300, 5 * 60), toToBase: leg(250, 4 * 60) }).amountMinor).toBe(900_00);
  });

  it("goes to an admin when the market has no driver base", () => {
    expect(driver({ toToBase: null })).toMatchObject({
      outcome: "pendingAdmin",
      reasons: ["noBase"],
      amountMinor: null,
    });
  });

  it("flags a straight-line return leg for an admin", () => {
    expect(driver({ toToBase: leg(10, 20, true) }).reasons).toEqual(["estimatedRoute"]);
  });

  it("sends multi-day trips to an admin", () => {
    expect(driver({ multiDay: true, toToBase: leg(10, 20) })).toMatchObject({
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
      {
        serviceType: "driver",
        withVehicle: false,
        requestedHours: 4,
        multiDay: false,
        fromToTo: leg(8.04672, 15),
        toToBase: leg(8.04672, 15),
      },
      india,
      "GBP",
      "mile",
    );
    expect(est.tripDistance).toBe(10);
  });
});

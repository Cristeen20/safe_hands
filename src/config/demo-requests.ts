import type { BookingStatus } from "@/domain/booking";
import type { AdminRequest } from "@/components/admin/request-detail";
import type { QueueRow } from "@/components/admin/request-queue";

/**
 * Made-up requests for the public admin demo (`/demo/admin`). Nothing here is
 * a real person, address or booking. Dates are relative to `now` so the demo
 * never goes stale.
 */
export function demoRequests(now: Date): AdminRequest[] {
  const at = (days: number, hour = 0) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    if (hour) d.setUTCHours(hour, 30, 0, 0);
    return d;
  };
  const staff = { actorName: "Demo Admin", actorRole: "admin" as const };
  const customerEvent = { actorName: "Sample customer", actorRole: "customer" as const };

  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

  function request(
    b: Partial<AdminRequest["booking"]> &
      Pick<AdminRequest["booking"], "serviceType" | "serviceAddress" | "scheduledStart" | "status" | "submittedAt">,
    extra: Partial<Omit<AdminRequest, "booking">> & {
      customerName: string;
      history: [BookingStatus, Date, boolean][];
    },
  ): AdminRequest {
    const bookingId = id();
    const recipientId = id();
    const { history, ...rest } = extra;
    return {
      customerPhone: null,
      customerEmail: "sample@example.com",
      recipient: {
        id: recipientId,
        ownerId: "demo",
        isSelf: true,
        firstName: "",
        lastName: "",
        phoneE164: null,
        createdAt: b.submittedAt,
        updatedAt: b.submittedAt,
      },
      quote: null,
      payments: [],
      ...rest,
      booking: {
        id: bookingId,
        customerId: "demo",
        recipientId,
        region: "IN",
        startAddress: "",
        startPoint: null,
        startNotes: "",
        servicePoint: null,
        serviceNotes: "",
        timeZone: "Asia/Kolkata",
        estimatedHours: null,
        vehicle: null,
        description: "",
        accompanyingCount: null,
        needsBystander: false,
        childSeat: false,
        days: null,
        partySize: null,
        includeFood: false,
        needsStay: false,
        tourKind: null,
        tourPackage: null,
        rejectionReason: null,
        priceEstimate: null,
        helperId: null,
        createdAt: b.submittedAt,
        updatedAt: b.submittedAt,
        ...b,
      },
      events: history.map(([toStatus, when, byStaff], i) => ({
        event: {
          id: id(),
          bookingId,
          fromStatus: i === 0 ? null : history[i - 1][0],
          toStatus,
          actorId: toStatus === "quoted" && !byStaff ? null : "demo",
          at: when,
        },
        ...(byStaff ? staff : customerEvent),
      })),
    };
  }

  const hospitalSubmitted = at(-1, 6);
  const hospital = request(
    {
      serviceType: "hospital_visit",
      status: "submitted",
      startAddress: "12 Lake View Road, Kadavanthra, 682020",
      serviceAddress: "Sample General Hospital, Edappally, 682024",
      startPoint: { lat: 9.9658, lng: 76.2999, placeId: "", source: "search" },
      servicePoint: { lat: 10.0261, lng: 76.3083, placeId: "", source: "search" },
      scheduledStart: at(4, 4),
      submittedAt: hospitalSubmitted,
      estimatedHours: 3,
      vehicle: "small",
      accompanyingCount: 1,
      needsBystander: true,
      description: "Outpatient check-up. Help at the registration desk and with collecting reports.",
      priceEstimate: {
        outcome: "pendingAdmin",
        reasons: ["estimatedRoute"],
        currency: "INR",
        distanceUnit: "kilometer",
        tripDistance: 135.4,
        driveHours: 3.8,
        billedHours: null,
        serviceHours: 3,
        amountMinor: 488500,
        legs: [
          { kind: "outbound", distance: 7.7, driveHours: 0.4 },
          { kind: "back", distance: 7.7, driveHours: 0.4 },
          { kind: "pickupReturn", distance: 120, driveHours: 3 },
        ],
        lines: [
          { kind: "distance", part: "serviceDrive", quantity: 15.4, rateMinor: 2500, amountMinor: 38500 },
          { kind: "distance", part: "toBase", quantity: 120, rateMinor: 2500, amountMinor: 300000 },
          { kind: "serviceTime", part: "service", quantity: 3, rateMinor: 50000, amountMinor: 150000 },
        ],
      },
    },
    {
      customerName: "Anita (sample)",
      recipient: {
        id: id(),
        ownerId: "demo",
        isSelf: false,
        firstName: "Mary",
        lastName: "(sample)",
        phoneE164: null,
        createdAt: hospitalSubmitted,
        updatedAt: hospitalSubmitted,
      },
      history: [["submitted", hospitalSubmitted, false]],
    },
  );

  const companion = request(
    {
      serviceType: "companion",
      status: "submitted",
      startAddress: "4 Temple Street, Fort Kochi, 682001",
      serviceAddress: "Sample Bank branch, MG Road, 682016",
      scheduledStart: at(6, 5),
      submittedAt: at(0, 2),
      estimatedHours: 2,
      description: "Go with my father to the bank to update his pension papers.",
    },
    { customerName: "Rahul (sample)", history: [["submitted", at(0, 2), false]] },
  );

  const driverSubmitted = at(-2, 9);
  const driverQuote = {
    id: id(),
    bookingId: "",
    amountMinor: 40000,
    currency: "INR",
    note: null,
    issuedBy: null,
    breakdown: [{ kind: "minimum" as const, quantity: 1, rateMinor: 40000, amountMinor: 40000 }],
    issuedAt: driverSubmitted,
    expiresAt: at(3),
  };
  const driver = request(
    {
      serviceType: "driver",
      status: "quoted",
      startAddress: "Sample Apartments, Kakkanad, 682030",
      serviceAddress: "Cochin International Airport, 683111",
      scheduledStart: at(5, 1),
      submittedAt: driverSubmitted,
      vehicle: "own",
    },
    {
      customerName: "Priya (sample)",
      quote: driverQuote,
      history: [
        ["submitted", driverSubmitted, false],
        ["quoted", driverSubmitted, false],
      ],
    },
  );
  driverQuote.bookingId = driver.booking.id;

  const cameraSubmitted = at(-4, 10);
  const cameraQuote = {
    id: id(),
    bookingId: "",
    amountMinor: 1200000,
    currency: "INR",
    note: "Includes edited photos within a week.",
    issuedBy: "demo",
    breakdown: null,
    issuedAt: at(-3, 8),
    expiresAt: at(4),
  };
  const camera = request(
    {
      serviceType: "camera",
      status: "confirmed",
      serviceAddress: "Sample Convention Hall, Vyttila, 682019",
      scheduledStart: at(9, 12),
      submittedAt: cameraSubmitted,
      estimatedHours: 4,
      description: "Grandmother's 80th birthday lunch, about 60 guests.",
    },
    {
      customerName: "Thomas (sample)",
      quote: cameraQuote,
      history: [
        ["submitted", cameraSubmitted, false],
        ["quoted", at(-3, 8), true],
        ["confirmed", at(-3, 11), false],
      ],
    },
  );
  cameraQuote.bookingId = camera.booking.id;
  camera.payments = [
    {
      id: id(),
      bookingId: camera.booking.id,
      quoteId: cameraQuote.id,
      provider: "razorpay",
      providerRef: null,
      providerPaymentId: null,
      amountMinor: cameraQuote.amountMinor,
      currency: "INR",
      status: "succeeded",
      late: false,
      createdAt: at(-3, 11),
      updatedAt: at(-3, 11),
    },
  ];

  const gift = request(
    {
      serviceType: "gift",
      status: "rejected",
      serviceAddress: "Sample Villas, Aluva, 683101",
      scheduledStart: at(3, 6),
      submittedAt: at(-1, 3),
      description: "Flowers and a cake for my sister's anniversary.",
      rejectionReason: "We can't deliver to Aluva on that date. Please try a day later in the week.",
    },
    {
      customerName: "Sara (sample)",
      history: [
        ["submitted", at(-1, 3), false],
        ["rejected", at(-1, 7), true],
      ],
    },
  );

  return [hospital, companion, driver, camera, gift];
}

/** The demo requests in the shape of the admin queue's rows. */
export function demoQueueRows(requests: AdminRequest[]): QueueRow[] {
  return requests
    .map(({ booking: b, customerName, customerPhone, customerEmail }) => ({
      id: b.id,
      status: b.status,
      serviceType: b.serviceType,
      startAddress: b.startAddress,
      serviceAddress: b.serviceAddress,
      scheduledStart: b.scheduledStart,
      timeZone: b.timeZone,
      submittedAt: b.submittedAt,
      customerName,
      customerPhone,
      customerEmail,
    }))
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
}

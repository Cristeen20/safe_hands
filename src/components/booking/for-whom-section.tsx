"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toE164 } from "@/lib/phone";
import { SERVICE_COUNTRY } from "@/lib/region";
import { GroupIcon, PersonIcon } from "@/components/ui/icons";
import { useBookingDraft } from "./draft-context";

const choiceCard = (on: boolean) =>
  `flex min-h-14 items-center gap-3 rounded-field text-[16px] font-semibold ${
    on ? "border-2 border-primary bg-primary-soft px-4 text-primary" : "border border-border-strong bg-card px-[17px] text-ink hover:border-primary"
  }`;

/** "Myself" or "someone else" (with their name and phone), on the details step. */
export function ForWhomSection() {
  const t = useTranslations("ForWhom");
  const { draft, update } = useBookingDraft();
  const [phoneError, setPhoneError] = useState(false);
  const other = draft.recipient.kind === "other" ? draft.recipient : null;
  const fields = other ?? { firstName: "", lastName: "", phone: "" };

  const setOther = (patch: Partial<typeof fields>) =>
    update({ recipient: { kind: "other", ...fields, ...patch } });

  const input =
    "h-12 w-full rounded-xl border border-border-strong bg-card px-3.5 text-base font-medium text-ink outline-none focus:border-[1.5px] focus:border-primary";

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("title")} className="grid grid-cols-2 gap-3 sm:max-w-md">
        <button
          type="button"
          aria-pressed={!other}
          onClick={() => update({ recipient: { kind: "self" } })}
          className={choiceCard(!other)}
        >
          <PersonIcon size={22} strokeWidth={1.9} />
          {t("me")}
        </button>
        <button
          type="button"
          aria-pressed={!!other}
          onClick={() => setOther({})}
          className={choiceCard(!!other)}
        >
          <GroupIcon size={22} strokeWidth={1.9} />
          {t("someoneElse")}
        </button>
      </div>

      {other && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("firstName")}
            <input
              required
              maxLength={60}
              autoComplete="off"
              value={fields.firstName}
              onChange={(e) => setOther({ firstName: e.target.value })}
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("lastName")}
            <input
              maxLength={60}
              autoComplete="off"
              value={fields.lastName}
              onChange={(e) => setOther({ lastName: e.target.value })}
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("phone")}
            <input
              type="tel"
              required
              autoComplete="off"
              value={fields.phone}
              aria-invalid={phoneError}
              aria-describedby={phoneError ? "fw-error" : "fw-note"}
              onChange={(e) => {
                setOther({ phone: e.target.value });
                setPhoneError(false);
              }}
              onBlur={() =>
                setPhoneError(!!fields.phone.trim() && !toE164(fields.phone, SERVICE_COUNTRY))
              }
              className={input}
            />
          </label>
          {phoneError ? (
            <p id="fw-error" role="alert" className="text-sm font-semibold text-red-700 sm:col-span-3">
              {t("invalidPhone")}
            </p>
          ) : (
            <p id="fw-note" className="text-sm text-muted sm:col-span-3">
              {t("note")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

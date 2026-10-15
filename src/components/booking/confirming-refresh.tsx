"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * After returning from a payment, refresh every 2s (up to 30s) until the
 * provider's confirmation has flipped the booking to confirmed.
 */
export function ConfirmingRefresh() {
  const router = useRouter();
  useEffect(() => {
    let ticks = 0;
    const id = setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks >= 15) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}

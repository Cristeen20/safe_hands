import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server render and hydration, true once React is in control.
 * Disable form submits until then: a submit before hydration falls back to a
 * native GET, reloading the page with the field values (e.g. a phone number)
 * in the URL.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

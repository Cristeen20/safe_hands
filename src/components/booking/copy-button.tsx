"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { iconButton } from "@/components/ui/styles";

/** Copies `text` to the clipboard and says so. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useTranslations("Common");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? t("copied") : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Clipboard blocked: the reference is still on screen to copy by hand.
        }
      }}
      className={iconButton}
    >
      {copied ? <CheckIcon size={18} strokeWidth={2.4} className="text-success" /> : <CopyIcon size={18} />}
    </button>
  );
}

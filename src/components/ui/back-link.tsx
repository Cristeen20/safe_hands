import { Link } from "@/i18n/navigation";
import { BackIcon } from "./icons";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-2 py-2 text-[15px] font-semibold text-primary no-underline hover:underline"
    >
      <BackIcon size={18} />
      {label}
    </Link>
  );
}

import Image from "next/image";
import type { ReactNode } from "react";

/**
 * A photo, or a tinted placeholder with an icon until the real photo exists
 * (see SERVICE_PHOTOS). The placeholder is decorative; a real photo gets `alt`.
 */
export function Photo({
  src,
  alt,
  icon,
  className = "",
  sizes = "100vw",
  priority = false,
}: {
  src: string | null;
  alt: string;
  icon: ReactNode;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center overflow-hidden bg-linear-to-br from-primary-soft via-[#eef2ec] to-accent-soft text-primary/35 ${className}`}
    >
      {icon}
    </div>
  );
}

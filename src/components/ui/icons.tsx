import type { SVGProps } from "react";

// Inline stroke icons copied from the canvas: 24px viewBox, currentColor.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const ArrowIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);
export const PersonIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12l4 4 10-10" />
  </Svg>
);
export const HospitalIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);
export const CarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 17h14M6 17l1.5-6h9L18 17" />
    <circle cx="8" cy="18" r="1.6" />
    <circle cx="16" cy="18" r="1.6" />
    <path d="M9 11V8h6v3" />
  </Svg>
);
export const VanIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 16V7h11v9M14 10h4l3 3v3h-7" />
    <circle cx="7" cy="17" r="1.6" />
    <circle cx="17" cy="17" r="1.6" />
  </Svg>
);
export const WalkIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="m9 21 3-7 3 3v4M12 14l1-5-3 1-2 3M13 9l3 3h3" />
  </Svg>
);
export const HandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 11.5V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.6 15a1.6 1.6 0 0 1 2.6-1.8L7 14.5" />
  </Svg>
);
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
  </Svg>
);
export const ListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </Svg>
);
export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

import { cn } from "@/lib/utils";

/**
 * Logo mark — "Layered release tag" concept:
 *  - Two amber tag-shaped layers offset diagonally for depth (suggests
 *    successive releases stacking up).
 *  - A single bold horizontal stroke through the front layer reads as a
 *    version-cut / changelog line.
 *  - A small "live" dot in the top-left of the front layer hints at a
 *    pinned/active release.
 *
 * Scales cleanly from 16px (favicon) up to 80px (hero). Aspect 32×28.
 */
export function LogoMark({
  className,
  size = 30,
  monochrome = false,
}: {
  className?: string;
  size?: number;
  /** Render as a single-color outline (used for inline contexts). */
  monochrome?: boolean;
}) {
  const gradId = "rl-mark-grad";
  const gradBack = "rl-mark-back";
  const gradHi = "rl-mark-hi";
  const h = size;
  const w = (size * 32) / 28;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 32 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="2"
          y1="4"
          x2="30"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="oklch(0.86 0.16 80)" />
          <stop offset="0.5" stopColor="oklch(0.74 0.2 56)" />
          <stop offset="1" stopColor="oklch(0.58 0.22 30)" />
        </linearGradient>
        <linearGradient
          id={gradBack}
          x1="6"
          y1="10"
          x2="32"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="oklch(0.55 0.18 38)" />
          <stop offset="1" stopColor="oklch(0.38 0.16 26)" />
        </linearGradient>
        <linearGradient
          id={gradHi}
          x1="0"
          y1="0"
          x2="0"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="white" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {monochrome ? (
        <>
          {/* Outline-only variant (for monochrome contexts like favicons). */}
          <path
            d="M5 9 H21 L28 15 L21 21 H5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            opacity="0.4"
          />
          <path
            d="M2 4 H18 L25 10 L18 16 H2 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <line
            x1="6"
            y1="10"
            x2="16"
            y2="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="4.5" cy="6.5" r="1.2" fill="currentColor" />
        </>
      ) : (
        <>
          {/* Back layer — implies "previous release", offset down-right. */}
          <path
            d="M5 9 H21 L28 15 L21 21 H5 Z"
            fill={`url(#${gradBack})`}
            opacity="0.85"
          />

          {/* Front layer — the "current" release tag. */}
          <path
            d="M2 4 H18 L25 10 L18 16 H2 Z"
            fill={`url(#${gradId})`}
            stroke="oklch(0.16 0.025 50)"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
          {/* Top highlight for dimensionality */}
          <path
            d="M2 4 H18 L25 10 L18 16 H2 Z"
            fill={`url(#${gradHi})`}
          />

          {/* Bold version-cut stroke through front layer */}
          <line
            x1="6"
            y1="10"
            x2="16"
            y2="10"
            stroke="oklch(0.14 0.02 50)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Live indicator dot */}
          <circle cx="4.5" cy="6.5" r="1.2" fill="oklch(0.14 0.02 50)" />
        </>
      )}
    </svg>
  );
}

/**
 * Logo — mark + wordmark. The wordmark uses tight tracking and slightly
 * heavier weight to feel branded at small sizes.
 */
export function Logo({
  className,
  size = 26,
  showWordmark = true,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[1.02rem] font-medium tracking-[-0.018em]">
          Releaser
        </span>
      )}
    </div>
  );
}

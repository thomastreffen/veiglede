import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Width = "narrow" | "content" | "wide" | "full";

interface Props {
  children: ReactNode;
  width?: Width;
  className?: string;
  /** Remove horizontal padding (use when the page renders edge-to-edge, e.g. map workspaces). */
  noPadding?: boolean;
}

const WIDTHS: Record<Width, string> = {
  narrow: "max-w-3xl",
  content: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

/**
 * Single source of truth for page horizontal sizing.
 *
 * Mobile is identical regardless of `width` — same paddings, same flow.
 * `width` only controls the desktop cap so each page can opt into the
 * right shape (narrow reading, default content, wide dashboard, full
 * workspace).
 */
export function PageContainer({ children, width = "content", className, noPadding = false }: Props) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        WIDTHS[width],
        !noPadding && "px-4 md:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

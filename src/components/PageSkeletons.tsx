import type { ReactNode } from "react";

/**
 * PageSkeletons
 *
 * Shared loading skeletons for each page. Uses Tailwind's built-in
 * `animate-pulse` so no custom keyframes are required in tailwind.config.
 *
 * Architecture reference: Seven Mynd Master Architecture v5.5, Section 10.6.
 * Layout constraints (max-w-[780px], safe-area awareness) match Section 10.4.
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" + visually-hidden "Loading…" text.
 *   - Individual shimmer blocks are aria-hidden.
 *
 * Theming: uses design tokens (bg-muted, bg-card, border-border) so skeletons
 * adapt to both light and dark themes defined in src/index.css.
 */

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

interface ShimmerProps {
  className?: string;
}

function Shimmer({ className }: ShimmerProps) {
  return (
    <div
      aria-hidden="true"
      className={joinClasses("bg-muted rounded-lg animate-pulse", className)}
    />
  );
}

interface PageChromeProps {
  children: ReactNode;
  label?: string;
}

function PageChrome({ children, label = "Loading" }: PageChromeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="w-full max-w-[780px] mx-auto px-4 md:px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 3.5rem + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)",
      }}
    >
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function ReviewsSkeleton() {
  return (
    <PageChrome label="Loading reviews">
      <Shimmer className="h-8 w-48 mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <Shimmer className="h-5 w-3/4 mb-3" />
            <Shimmer className="h-4 w-full mb-2" />
            <Shimmer className="h-4 w-2/3 mb-4" />
            <div className="flex flex-wrap gap-2">
              <Shimmer className="h-11 w-24" />
              <Shimmer className="h-11 w-24" />
              <Shimmer className="h-11 w-24" />
            </div>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

export function VaultSkeleton() {
  return (
    <PageChrome label="Loading memory vault">
      <Shimmer className="h-8 w-40 mb-6" />
      <div className="flex flex-wrap gap-2 mb-6">
        <Shimmer className="h-11 w-24" />
        <Shimmer className="h-11 w-24" />
        <Shimmer className="h-11 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-4"
          >
            <Shimmer className="h-4 w-1/3 mb-2" />
            <Shimmer className="h-4 w-full mb-1" />
            <Shimmer className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

export function LibrarySkeleton() {
  return (
    <PageChrome label="Loading library">
      <div className="mb-5">
        <Shimmer className="h-8 w-40 mb-2" />
        <Shimmer className="h-4 w-56" />
      </div>
      <Shimmer className="h-11 w-full mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-4"
          >
            <Shimmer className="h-4 w-1/2 mb-2" />
            <Shimmer className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

export function TraceSkeleton() {
  return (
    <PageChrome label="Loading trace">
      <div className="mb-6">
        <Shimmer className="h-8 w-48 mb-2" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-4"
          >
            <Shimmer className="h-4 w-full mb-2" />
            <Shimmer className="h-3 w-20" />
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

export function DigestSkeleton() {
  return (
    <PageChrome label="Loading digest">
      <div className="mb-6">
        <Shimmer className="h-3 w-24 mb-2" />
        <Shimmer className="h-8 w-48 mb-2" />
        <Shimmer className="h-4 w-56" />
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <Shimmer className="h-5 w-40 mb-4" />
        <Shimmer className="h-4 w-full mb-2" />
        <Shimmer className="h-4 w-full mb-2" />
        <Shimmer className="h-4 w-3/4" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4">
            <Shimmer className="h-4 w-4 mb-2" />
            <Shimmer className="h-6 w-10 mb-1" />
            <Shimmer className="h-3 w-20" />
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

export function MemorySkeleton() {
  return (
    <PageChrome label="Loading memory">
      <div className="mb-6">
        <Shimmer className="h-8 w-48 mb-2" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-3 text-center">
            <Shimmer className="h-6 w-12 mx-auto mb-1" />
            <Shimmer className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-3"
          >
            <Shimmer className="h-4 w-3/4 mb-2" />
            <Shimmer className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

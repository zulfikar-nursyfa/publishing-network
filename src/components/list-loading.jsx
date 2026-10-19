import { LoaderCircle } from "lucide-react";

export function ListLoading({ children }) {
  return (
    <div data-list-results className="relative min-w-0">
      <div data-list-content>{children}</div>
      <div className="list-results-loader absolute inset-0 z-10 rounded-lg bg-background/70">
        <div
          role="status"
          className="sticky top-20 mx-auto mt-6 flex h-fit w-fit items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium shadow-sm"
        >
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          Loading results…
        </div>
      </div>
    </div>
  );
}

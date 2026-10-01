import { ArrowLeft, FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-6" />
        </div>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page does not exist, or you do not have access to it.</p>
        <ButtonLink href="/" variant="secondary" className="mt-6">
          <ArrowLeft />
          Back to the overview
        </ButtonLink>
      </div>
    </main>
  );
}

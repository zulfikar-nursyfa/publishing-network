import { DocsNav } from "./docs-nav";

export default function DocsLayout({ children }) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <aside className="lg:sticky lg:top-6 lg:w-60 lg:shrink-0 lg:self-start">
        <DocsNav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

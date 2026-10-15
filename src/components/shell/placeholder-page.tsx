import { Skeleton } from "@/components/ui/skeleton";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

/**
 * Every dashboard route in Phase 5 is a placeholder — this renders a
 * consistent "not built yet" message plus a skeleton mockup of where real
 * content will go, so the Skeleton component is actually exercised (not
 * just defined and unused) and every page previews the loading-state look
 * the real content will eventually use.
 */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/70 bg-card p-4 shadow-soft"
          >
            <Skeleton className="mb-3 h-4 w-2/3" />
            <Skeleton className="mb-2 h-3 w-full" />
            <Skeleton className="mb-4 h-3 w-5/6" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
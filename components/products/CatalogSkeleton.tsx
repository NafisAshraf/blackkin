import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogSkeleton({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24 rounded-none" />
          <Skeleton className="h-3 w-20 rounded-none" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-none" />
          <Skeleton className="h-9 w-24 rounded-none" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="aspect-[4/5] w-full rounded-none" />
            <Skeleton className="h-4 w-3/4 rounded-none" />
            <Skeleton className="h-4 w-20 rounded-none" />
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) return content;
  return (
    <main className="w-full max-w-[1500px] mx-auto px-6 lg:px-10 pt-12 pb-48">
      {content}
    </main>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

function ProductInfoSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-12 rounded-none" />
          <Skeleton className="h-8 w-12 rounded-none" />
          <Skeleton className="h-8 w-12 rounded-none" />
          <Skeleton className="h-8 w-12 rounded-none" />
        </div>
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-[54px] flex-1 rounded-none" />
        <Skeleton className="h-[54px] flex-1 rounded-none" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-4">
          <Skeleton className="h-11 w-[136px] rounded-none" />
          <Skeleton className="h-11 flex-1 rounded-none" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-11 flex-1 rounded-none" />
          <Skeleton className="h-11 flex-1 rounded-none" />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

export default function ProductDetailSkeleton() {
  return (
    <>
      <div className="lg:hidden">
        <Skeleton className="aspect-[3/4] w-full rounded-none" />
        <section className="px-5 py-6">
          <ProductInfoSkeleton />
        </section>
      </div>

      <div className="hidden lg:flex w-full">
        <div className="w-1/2 flex-shrink-0 space-y-1">
          <Skeleton className="aspect-[3/4] w-full rounded-none" />
          <Skeleton className="aspect-[3/4] w-full rounded-none" />
        </div>
        <div className="w-1/2 flex-shrink-0 px-10 pt-10">
          <div className="sticky top-[70px] space-y-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-2" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <ProductInfoSkeleton />
          </div>
        </div>
      </div>
    </>
  );
}

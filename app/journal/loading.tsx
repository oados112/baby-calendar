import { PageNav } from "@/components/page-nav";
import { SkeletonBlock, SkeletonList, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="pt-[calc(1rem+var(--safe-top))]">
        <PageNav />
      </div>
      <div className="px-4">
        <SkeletonBlock className="mx-auto h-11 w-48" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
        </div>
        <SkeletonBlock className="mt-6 h-4 w-24" />
        <div className="mt-3">
          <SkeletonList rows={6} />
        </div>
      </div>
    </SkeletonPage>
  );
}

import { PageNav } from "@/components/page-nav";
import { SkeletonBlock, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="pt-[calc(1rem+var(--safe-top))]">
        <PageNav />
      </div>
      <div className="px-4">
        <SkeletonBlock className="h-5 w-44" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
        </div>
        <SkeletonBlock className="mt-5 h-48" />
        <SkeletonBlock className="mt-5 h-48" />
      </div>
    </SkeletonPage>
  );
}

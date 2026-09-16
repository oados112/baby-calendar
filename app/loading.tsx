import { PageNav } from "@/components/page-nav";
import {
  SkeletonBlock,
  SkeletonHeader,
  SkeletonList,
  SkeletonPage,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <PageNav />
      <div className="px-4">
        <div className="grid grid-cols-3 gap-2.5">
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-28" />
        </div>
        <SkeletonBlock className="mt-7 h-4 w-20" />
        <div className="mt-3">
          <SkeletonList />
        </div>
      </div>
    </SkeletonPage>
  );
}

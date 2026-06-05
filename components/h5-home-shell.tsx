import type { ReactNode } from "react";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";

export function H5HomeShell({
  carousel,
  latestPanel
}: {
  carousel: ReactNode;
  latestPanel: ReactNode;
}) {
  return (
    <>
      <div className="h5-container">
        {carousel}
        <div className="h5-home-feed-panels">
          <div className="h5-home-feed-panel">{latestPanel}</div>
        </div>
      </div>

      <H5SiteBottomNav active="home" />
    </>
  );
}

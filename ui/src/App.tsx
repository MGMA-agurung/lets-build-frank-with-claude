import { useEffect, useState } from "react";
import AppLayout from "@cloudscape-design/components/app-layout";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import type { FrankClient } from "./frank/client";
import { Overview } from "./pages/Overview";
import { Tools } from "./pages/Tools";

export type PageId = "overview" | "tools";

const PAGES: Record<PageId, string> = { overview: "Overview", tools: "Tools" };

function pageFromHash(hash: string): PageId | null {
  const id = hash.replace(/^#\/?/, "");
  return id in PAGES ? (id as PageId) : null;
}

export interface AppProps {
  client: FrankClient;
  initialPage?: PageId;
}

/** The console shell: two pages, all Cloudscape (ADR-003). */
export function App({ client, initialPage }: AppProps) {
  const [page, setPage] = useState<PageId>(() => initialPage ?? pageFromHash(window.location.hash) ?? "overview");

  useEffect(() => {
    const onHash = () => setPage(pageFromHash(window.location.hash) ?? "overview");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <AppLayout
      toolsHide
      navigation={
        <SideNavigation
          header={{ text: "Frank", href: "#/overview" }}
          activeHref={`#/${page}`}
          items={(Object.keys(PAGES) as PageId[]).map((id) => ({ type: "link", text: PAGES[id], href: `#/${id}` }))}
          onFollow={(event) => {
            const next = pageFromHash(event.detail.href);
            if (next) {
              event.preventDefault();
              window.location.hash = `/${next}`;
              setPage(next);
            }
          }}
        />
      }
      content={page === "overview" ? <Overview client={client} /> : <Tools client={client} />}
    />
  );
}

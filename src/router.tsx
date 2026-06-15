import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // E2E hook: expose the query cache in the browser so Playwright can read
  // the unfiltered datasets and compute the expected filtered list.
  if (typeof window !== "undefined") {
    (window as unknown as { __QC__?: QueryClient }).__QC__ = queryClient;
  }



  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

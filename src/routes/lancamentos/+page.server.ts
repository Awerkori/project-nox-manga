import { fetchPaginatedReleasesFromYugabyte } from "$lib/server/yugabyte";

export const load = async ({ url, platform, setHeaders }: any) => {
  if (setHeaders) {
    setHeaders({
      "cache-control": "public, max-age=0, s-maxage=2, must-revalidate"
    });
  }

  const rawPage = url.searchParams.get("page");
  const parsedPage = rawPage ? parseInt(rawPage, 10) : 1;
  const currentPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const rawKind = url.searchParams.get("kind");
  const kind = rawKind && rawKind.toUpperCase() !== "ALL" ? rawKind.toUpperCase() : null;

  const PAGE_SIZE = 24;
  const CHAPTERS_PER_WORK = 4;

  try {
    const result = await fetchPaginatedReleasesFromYugabyte(
      currentPage,
      PAGE_SIZE,
      CHAPTERS_PER_WORK,
      platform?.env,
      kind
    );

    return {
      releases: result.releases,
      totalWorks: result.totalWorks,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      pageSize: result.pageSize,
      selectedKind: kind || "ALL",
      loadError: false
    };
  } catch (err) {
    console.error("[LANCAMENTOS SERVER LOAD ERROR]:", err);
    return {
      releases: [],
      totalWorks: 0,
      totalPages: 1,
      currentPage,
      pageSize: PAGE_SIZE,
      selectedKind: kind || "ALL",
      loadError: true
    };
  }
};

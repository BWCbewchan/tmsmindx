import K12DocsClient from "@/components/k12-docs/K12DocsClient";
import { loadK12LeaderDocs } from "@/lib/k12-leader-docs";

interface PageProps {
  searchParams: Promise<{ doc?: string | string[] }>;
}

export default async function QuyTrinhQuyDinhLeaderPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const docs = await loadK12LeaderDocs({ includeDraft: true });
  const rawDoc = params.doc;
  const selectedSlug = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc || docs.defaultSlug;

  return (
    <K12DocsClient
      basePath="/admin/quy-trinh-quy-dinh-leader"
      pageTitle="Quy Trình, Quy Định K12 Teaching - Leader/TE/TC"
      tree={docs.tree}
      documents={docs.documents}
      selectedSlug={selectedSlug}
      defaultSlug={docs.defaultSlug}
    />
  );
}

import { RedesignOrderDetail } from "@/components/redesign/redesign-order-detail";

export default function RedesignOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div
      className="redesign-order-workbench"
      data-design-seed="953c4cb7-order-workbench"
    >
      {/*
        ORDER WORKBENCH CONTRACT — seed key 953c4cb7-order-workbench
        THESIS: The next decision leads; the record supports it instead of burying it in tabs.
        OWN-WORLD: Existing Anajak cobalt work paper, blueprint rules, compact industrial notation.
        STORY: Understand the order, see the interruption, continue in the authoritative workflow.
        FIRST VIEWPORT: Action docket and seven-stage lifecycle lead; work facts stay within one scan.
        FORM: Operate-mode extension of the approved Swiss industrial production manual.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
      */}
      <RedesignOrderDetail params={params} />
    </div>
  );
}

import { RedesignOrdersRegistry } from "@/components/redesign/redesign-orders-registry";

export default function RedesignOrdersPage() {
  return (
    <div
      className="redesign-orders-registry-route"
      data-design-seed="953c4cb7-orders-registry"
    >
      {/*
        ORDERS REGISTRY CONTRACT — seed key 953c4cb7-orders-registry
        THESIS: Find the record that must move; the registry is a decision ledger, not another dashboard.
        OWN-WORLD: Existing Anajak cobalt work paper, blueprint rules, compact industrial notation.
        STORY: Narrow the live order book, preserve the query, open the authoritative workbench.
        FIRST VIEWPORT: Search and urgency lenses lead; the first live records stay visible without scrolling past metrics.
        FORM: Operate-mode extension of the approved Swiss industrial production manual.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, verdict, and DESIGN.md.
      */}
      <RedesignOrdersRegistry />
    </div>
  );
}

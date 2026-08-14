import { RedesignProductionControl } from "@/components/redesign/redesign-production-control";

export default function RedesignProductionPage() {
  return (
    <div
      className="redesign-production-control-route"
      data-design-seed="953c4cb7-production-control"
    >
      {/*
        PRODUCTION CONTROL CONTRACT — seed key 953c4cb7-production-control
        THESIS: Clear the constraints before reading capacity; the floor only sees work it can move.
        OWN-WORLD: Existing Anajak cobalt work paper, blueprint rules, compact industrial notation.
        STORY: Resolve exceptions, release ready orders, filter the live lanes, continue in the guarded workflow.
        FIRST VIEWPORT: Exception docket and release gate lead; lane balance supports the decision below them.
        FORM: Operate-mode extension of the approved Swiss industrial production manual.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, verdict, and DESIGN.md.
      */}
      <RedesignProductionControl />
    </div>
  );
}

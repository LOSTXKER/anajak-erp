"use client";

import { useRef, useState } from "react";
import { ProductionDeskPreview } from "@/components/production/production-desk-preview";
import { STATION_OUTSOURCE_ALL, type ProductionDeskVariant } from "@/components/production/production-desk-view";
import { buildProductionBoard, filterBoardJobs } from "@/lib/production-board";
import { buildDeskRows, deskSummary, filterDeskRows, type DeskLens } from "@/lib/production-desk";
import { sortDeskRows, type DeskSort } from "@/lib/production-desk-sort";
import { filterWorklistByStation, resolveWorklistStation, worklistStationChips } from "@/lib/production-worklist";
import { createDemoState, DEFAULT_ACTORS } from "../production-flow/_domain";
import { baselineDeskOrders } from "../production-flow/_components/current-baseline";
import { useProtoFlag } from "../_kit/use-proto-variant";

const state = createDemoState();
const { orders, unknownOrders } = baselineDeskOrders(state, "supervisor");
const now = new Date(state.clock);
const board = buildProductionBoard(orders, { now, viewerId: DEFAULT_ACTORS.supervisor.id, showBlocked: true });
const fixtureRows = buildDeskRows(board, now);

/** The same read-only fixture and filtering rules feed all three layouts. */
export function UiResetDesk({ variant }: { variant: ProductionDeskVariant }) {
  const [empty] = useProtoFlag("empty");
  const [lens, setLens] = useState<DeskLens>("all");
  const [search, setSearch] = useState("");
  const [selectedStation, setStation] = useState("");
  const [sort, setSort] = useState<DeskSort>({ key: "deadline", direction: "asc" });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rows = empty ? [] : fixtureRows;
  const searched = new Set(filterBoardJobs(board.jobs, board.stations, "", search).map((job) => job.key));
  const lensRows = filterDeskRows(rows, lens).filter((row) => searched.has(row.job.key));
  const stations = worklistStationChips(board.stations, lensRows.map((row) => row.job));
  const station = selectedStation === STATION_OUTSOURCE_ALL ? selectedStation : resolveWorklistStation(selectedStation, stations);
  const outsourceKeys = new Set(stations.filter((chip) => chip.isOutsource).map((chip) => chip.key));
  const outsourceRows = lensRows.filter((row) => row.job.stationKeys.some((key) => outsourceKeys.has(key)));
  const stationKeys = new Set(filterWorklistByStation(lensRows.map((row) => row.job), station).map((job) => job.key));
  const visibleRows = station === STATION_OUTSOURCE_ALL ? outsourceRows : lensRows.filter((row) => stationKeys.has(row.job.key));
  const unknown = empty || lens !== "all" || station ? [] : unknownOrders.filter((order) => `${order.number} ${order.customer}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-w-0">
      <ProductionDeskPreview
        variant={variant}
        rows={sortDeskRows(visibleRows, sort)}
        total={rows.length}
        tiles={{ summary: deskSummary(rows), lens, onSelectLens: setLens }}
        toolbar={{ searchDefault: search, searchInputRef, onSearchChange: setSearch, station, stations, outsourceTotal: outsourceRows.length, outsourceOverdue: outsourceRows.filter((row) => row.job.overdue).length, onSelectStation: setStation, total: lensRows.length }}
        sort={sort}
        onSort={(key, direction) => setSort({ key, direction })}
        filtered={lens !== "all" || Boolean(search) || Boolean(station)}
        onClearFilters={() => { setLens("all"); setSearch(""); setStation(""); if (searchInputRef.current) searchInputRef.current.value = ""; }}
        unknownOrders={unknown}
      />
    </div>
  );
}

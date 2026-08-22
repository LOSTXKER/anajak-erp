"use client";

import { createContext, useContext, type ReactNode } from "react";

const ProductionV2Context = createContext(false);

export function ProductionV2Provider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <ProductionV2Context.Provider value={enabled}>
      {children}
    </ProductionV2Context.Provider>
  );
}

export function useProductionV2Enabled() {
  return useContext(ProductionV2Context);
}

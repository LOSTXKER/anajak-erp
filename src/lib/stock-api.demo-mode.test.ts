import { afterEach, describe, expect, it, vi } from "vitest";
import { getStockClient, StockApiClient } from "./stock-api";

const originalDemoMode = process.env.ANAJAK_ERP_DEMO_MODE;
const originalUrl = process.env.ANAJAK_STOCK_API_URL;
const originalKey = process.env.ANAJAK_STOCK_API_KEY;

afterEach(() => {
  if (originalDemoMode === undefined) delete process.env.ANAJAK_ERP_DEMO_MODE;
  else process.env.ANAJAK_ERP_DEMO_MODE = originalDemoMode;
  if (originalUrl === undefined) delete process.env.ANAJAK_STOCK_API_URL;
  else process.env.ANAJAK_STOCK_API_URL = originalUrl;
  if (originalKey === undefined) delete process.env.ANAJAK_STOCK_API_KEY;
  else process.env.ANAJAK_STOCK_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe("Stock client in local demo mode", () => {
  it("does not construct the environment-configured Stock client", () => {
    process.env.ANAJAK_ERP_DEMO_MODE = "1";
    process.env.ANAJAK_STOCK_API_URL = "https://stock.example.invalid";
    process.env.ANAJAK_STOCK_API_KEY = "would-be-live-key";

    expect(getStockClient()).toBeNull();
  });

  it("blocks outbound requests even when a client is constructed explicitly", async () => {
    process.env.ANAJAK_ERP_DEMO_MODE = "1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new StockApiClient("https://stock.example.invalid", "would-be-live-key");

    await expect(client.getProducts()).rejects.toMatchObject({
      name: "StockApiError",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

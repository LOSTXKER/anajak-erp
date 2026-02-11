import { router } from "../trpc";
import { customerRouter } from "./customer";
import { orderRouter } from "./order";
import { productionRouter } from "./production";
import { designRouter } from "./design";
import { billingRouter } from "./billing";
import { outsourceRouter } from "./outsource";
import { analyticsRouter } from "./analytics";
import { quotationRouter } from "./quotation";
import { productRouter } from "./product";
import { deliveryRouter } from "./delivery";
import { notificationRouter } from "./notification";
import { costRouter } from "./cost";
import { attachmentRouter } from "./attachment";
import { serviceCatalogRouter } from "./service-catalog";
import { stockSyncRouter } from "./stock-sync";

export const appRouter = router({
  customer: customerRouter,
  order: orderRouter,
  production: productionRouter,
  design: designRouter,
  billing: billingRouter,
  outsource: outsourceRouter,
  analytics: analyticsRouter,
  quotation: quotationRouter,
  product: productRouter,
  delivery: deliveryRouter,
  notification: notificationRouter,
  cost: costRouter,
  attachment: attachmentRouter,
  serviceCatalog: serviceCatalogRouter,
  stockSync: stockSyncRouter,
});

export type AppRouter = typeof appRouter;

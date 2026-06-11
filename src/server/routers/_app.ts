import { router } from "../trpc";
import { customerRouter } from "./customer";
import { orderRouter } from "./order";
import { productionRouter } from "./production";
import { designRouter } from "./design";
import { billingRouter } from "./billing";
import { billingNoteRouter } from "./billing-note";
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
import { patternRouter } from "./pattern";
import { packagingRouter } from "./packaging";
import { settingsRouter } from "./settings";
import { userRouter } from "./user";
import { taskRouter } from "./task";

export const appRouter = router({
  user: userRouter,
  customer: customerRouter,
  order: orderRouter,
  production: productionRouter,
  design: designRouter,
  billing: billingRouter,
  billingNote: billingNoteRouter,
  outsource: outsourceRouter,
  analytics: analyticsRouter,
  quotation: quotationRouter,
  product: productRouter,
  delivery: deliveryRouter,
  notification: notificationRouter,
  cost: costRouter,
  attachment: attachmentRouter,
  serviceCatalog: serviceCatalogRouter,
  pattern: patternRouter,
  packaging: packagingRouter,
  stockSync: stockSyncRouter,
  settings: settingsRouter,
  task: taskRouter,
});

export type AppRouter = typeof appRouter;

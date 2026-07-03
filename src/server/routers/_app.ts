import { router } from "../trpc";
import { customerRouter } from "./customer";
import { orderRouter } from "./order";
import { productionRouter } from "./production";
import { designRouter } from "./design";
import { billingRouter } from "./billing";
import { billingNoteRouter } from "./billing-note";
import { outsourceRouter } from "./outsource";
import { outsourceShareRouter } from "./outsource-share";
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
import { goodsReceiptRouter } from "./goods-receipt";
import { printRunRouter } from "./print-run";
import { filmStockRouter } from "./film-stock";
import { whtRouter } from "./wht";
import { qcRouter } from "./qc";
import { artworkRouter } from "./artwork";
import { customerUploadRouter } from "./customer-upload";
import { customerStatusRouter } from "./customer-status";
import { quotationConfirmRouter } from "./quotation-confirm";

export const appRouter = router({
  user: userRouter,
  customer: customerRouter,
  order: orderRouter,
  production: productionRouter,
  design: designRouter,
  billing: billingRouter,
  billingNote: billingNoteRouter,
  outsource: outsourceRouter,
  outsourceShare: outsourceShareRouter,
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
  goodsReceipt: goodsReceiptRouter,
  printRun: printRunRouter,
  filmStock: filmStockRouter,
  wht: whtRouter,
  qc: qcRouter,
  artwork: artworkRouter,
  customerUpload: customerUploadRouter,
  customerStatus: customerStatusRouter,
  quotationConfirm: quotationConfirmRouter,
});

export type AppRouter = typeof appRouter;

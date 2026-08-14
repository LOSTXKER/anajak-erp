type UnknownRow = Record<string, unknown>;
type CanonicalScalar = string | number | boolean | null;

function asRow(value: unknown): UnknownRow {
  return typeof value === "object" && value !== null
    ? (value as UnknownRow)
    : {};
}

function asRows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Prisma result extensions turn Decimal into number, but keeping Decimal-like
 * support here makes the token identical in tests and in unextended callers.
 */
function canonicalScalar(value: unknown): CanonicalScalar {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Object.is(value, -0) ? 0 : value;
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

function pick(rowValue: unknown, keys: readonly string[]) {
  const row = asRow(rowValue);
  return Object.fromEntries(
    keys.map((key) => [key, canonicalScalar(row[key])]),
  );
}

function sortCanonical<T>(values: T[]): T[] {
  return values.sort((left, right) => {
    const leftJson = JSON.stringify(left);
    const rightJson = JSON.stringify(right);
    return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
  });
}

function canonicalVariant(value: unknown) {
  return pick(value, ["id", "size", "color", "quantity"]);
}

function canonicalProduct(value: unknown) {
  const row = asRow(value);
  return {
    ...pick(row, [
      "id",
      "sortOrder",
      "productId",
      "productType",
      "description",
      "material",
      "baseUnitPrice",
      "discount",
      "totalQuantity",
      "subtotal",
      "itemSource",
      "packagingOptionId",
      "fabricType",
      "fabricWeight",
      "fabricColor",
      "processingType",
      "patternId",
      "collarType",
      "sleeveType",
      "bodyFit",
      "patternFileUrl",
      "patternNote",
      "garmentCondition",
      "receivedInspected",
      "receiveNote",
    ]),
    variants: sortCanonical(asRows(row.variants).map(canonicalVariant)),
  };
}

function canonicalPrint(value: unknown) {
  return pick(value, [
    "id",
    "position",
    "printType",
    "colorCount",
    "printSize",
    "width",
    "height",
    "designNote",
    "designImageUrl",
    "artworkId",
    "unitPrice",
  ]);
}

function canonicalAddon(value: unknown) {
  return pick(value, [
    "id",
    "addonType",
    "name",
    "description",
    "pricingType",
    "unitPrice",
    "quantity",
    "notes",
  ]);
}

function canonicalItem(value: unknown) {
  const row = asRow(value);
  return {
    ...pick(row, [
      "id",
      "sortOrder",
      "description",
      "totalQuantity",
      "subtotal",
      "taxLineType",
      "notes",
    ]),
    products: sortCanonical(asRows(row.products).map(canonicalProduct)),
    prints: sortCanonical(asRows(row.prints).map(canonicalPrint)),
    addons: sortCanonical(asRows(row.addons).map(canonicalAddon)),
  };
}

/**
 * Collision-free baseline token for every persisted child field that the full
 * edit form replaces. Row ids are intentional: delete/recreate with the same
 * visible text is still a concurrent identity change.
 */
export function orderItemsFingerprint(items: readonly unknown[]): string {
  return JSON.stringify(sortCanonical(items.map(canonicalItem)));
}

export function orderFeesFingerprint(fees: readonly unknown[]): string {
  return JSON.stringify(
    sortCanonical(
      fees.map((fee) =>
        pick(fee, [
          "id",
          "feeType",
          "name",
          "description",
          "amount",
          "notes",
        ]),
      ),
    ),
  );
}

export function orderReferenceImagesFingerprint(
  attachments: readonly unknown[],
): string {
  return JSON.stringify(
    sortCanonical(
      attachments.map((attachment) =>
        pick(attachment, [
          "id",
          "fileName",
          "fileUrl",
          "fileType",
          "fileSize",
          "category",
          "printPosition",
          "uploadedById",
          "notes",
        ]),
      ),
    ),
  );
}

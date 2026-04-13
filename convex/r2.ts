import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth.helpers";

export const r2 = new R2(components.r2);

export const { generateUploadUrl, syncMetadata, deleteObject } = r2.clientApi<DataModel>({
  checkUpload: async (ctx) => {
    await requireAdmin(ctx);
  },
  checkDelete: async (ctx) => {
    await requireAdmin(ctx);
  },
  onUpload: async () => {},
});

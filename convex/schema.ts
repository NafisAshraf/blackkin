import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── USERS (extended from existing) ────────────────────────
  users: defineTable({
    authUserId: v.string(),
    name: v.optional(v.string()),
    email: v.string(),
    role: v.union(v.literal("customer"), v.literal("admin")),
    isActive: v.optional(v.boolean()), // undefined = active, false = deactivated
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_role", ["role"])
    .index("by_email", ["email"]),

  // ─── PLATFORM CONFIG (admin-defined master lists) ──────────
  platformSizes: defineTable({
    name: v.string(), // e.g. "S", "M", "L", "XL"
    measurements: v.string(), // tooltip text e.g. "Chest: 36-38\", Waist: 28-30\""
    sortOrder: v.number(),
  }).index("by_name", ["name"]),

  platformColors: defineTable({
    name: v.string(), // e.g. "Black", "White", "Navy"
    hexCode: v.optional(v.string()), // e.g. "#000000"
    sortOrder: v.number(),
  }).index("by_name", ["name"]),

  // ─── CATEGORIES ──────────────────────────────────────────
  categories: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    isActive: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_isActive", ["isActive"])
    .index("by_isActive_and_sortOrder", ["isActive", "sortOrder"]),

  // ─── TAGS (Dynamic Merchandising Tags) ───────────────────
  tags: defineTable({
    name: v.string(),
    slug: v.string(),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_isActive", ["isActive"]),

  // ─── PRODUCTS ────────────────────────────────────────────
  products: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    basePrice: v.number(), // price in BDT (whole number)
    isActive: v.boolean(),
    totalRatings: v.number(), // denormalized count of approved reviews
    averageRating: v.number(), // denormalized average rating
    // Media stored inline - bounded list, well under 8192 limit
    media: v.array(
      v.object({
        storageId: v.id("_storage"),
        type: v.union(v.literal("image"), v.literal("video")),
        sortOrder: v.number(),
      })
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_categoryId", ["categoryId"])
    .index("by_isActive", ["isActive"])
    .index("by_categoryId_and_isActive", ["categoryId", "isActive"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["categoryId", "isActive"],
    }),

  // ─── PRODUCT VARIANTS ────────────────────────────────────
  productVariants: defineTable({
    productId: v.id("products"),
    size: v.string(),
    color: v.optional(v.string()),
    sku: v.optional(v.string()),
    stock: v.number(),
    priceOverride: v.optional(v.number()),
  })
    .index("by_productId", ["productId"])
    .index("by_productId_and_size", ["productId", "size"])
    .index("by_productId_and_size_and_color", ["productId", "size", "color"]),

  // ─── PRODUCT-TAG JUNCTION ─────────────────────────────────
  productTags: defineTable({
    productId: v.id("products"),
    tagId: v.id("tags"),
  })
    .index("by_productId", ["productId"])
    .index("by_tagId", ["tagId"])
    .index("by_productId_and_tagId", ["productId", "tagId"]),

  // ─── SALES / DISCOUNT CAMPAIGNS ──────────────────────────
  salesCampaigns: defineTable({
    name: v.string(), // e.g. "Winter Flash Sale"
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(), // percentage (0-100) or fixed BDT amount
    startTime: v.number(), // unix ms
    endTime: v.number(), // unix ms
    scope: v.union(
      v.object({ type: v.literal("storewide") }),
      v.object({ type: v.literal("category"), categoryId: v.id("categories") }),
      v.object({ type: v.literal("tag"), tagId: v.id("tags") }),
      v.object({ type: v.literal("product"), productId: v.id("products") })
    ),
    isActive: v.boolean(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_isActive_and_endTime", ["isActive", "endTime"]),

  // ─── PRODUCT RECOMMENDATIONS (admin-selected, GLOBAL) ────
  // "also_like" shows on ALL product pages. "also_bought" shows at checkout filtered by size.
  // "best_sellers" and "new_arrivals" show on landing page (top 3 by sortOrder).
  productRecommendations: defineTable({
    type: v.union(
      v.literal("also_like"),
      v.literal("also_bought"),
      v.literal("best_sellers"),
      v.literal("new_arrivals")
    ),
    recommendedProductId: v.id("products"),
    forSize: v.optional(v.string()), // null = all sizes; "M" = only when M is in cart
    sortOrder: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_type_and_forSize", ["type", "forSize"]),

  // ─── CART (logged-in users; guest cart is localStorage) ───
  cartItems: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    variantId: v.id("productVariants"),
    quantity: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_variantId", ["userId", "variantId"]),

  // ─── WISHLIST ─────────────────────────────────────────────
  wishlistItems: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_productId", ["userId", "productId"]),

  // ─── USER SAVED ADDRESSES ─────────────────────────────────
  userAddresses: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("home"), v.literal("work")),
    name: v.string(),
    phone: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    city: v.string(),
    postalCode: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_type", ["userId", "type"]),

  // ─── ORDERS ───────────────────────────────────────────────
  orders: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    shippingAddress: v.object({
      name: v.string(),
      phone: v.string(),
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      postalCode: v.optional(v.string()),
    }),
    subtotal: v.number(),
    discountAmount: v.number(),
    total: v.number(),
    paymentMethod: v.optional(v.string()),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("refunded")
    ),
    notes: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_userId_and_status", ["userId", "status"]),

  // ─── ORDER ITEMS (snapshot at purchase time) ──────────────
  orderItems: defineTable({
    orderId: v.id("orders"),
    productId: v.id("products"),
    variantId: v.id("productVariants"),
    productName: v.string(), // snapshot
    size: v.string(), // snapshot
    color: v.optional(v.string()), // snapshot
    unitPrice: v.number(), // price after discount
    quantity: v.number(),
    totalPrice: v.number(),
  })
    .index("by_orderId", ["orderId"])
    .index("by_productId", ["productId"]),

  // ─── REVIEWS ──────────────────────────────────────────────
  reviews: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    orderId: v.id("orders"), // proves purchase
    rating: v.number(), // 1-5
    comment: v.optional(v.string()),
    isApproved: v.boolean(),
  })
    .index("by_productId", ["productId"])
    .index("by_productId_and_isApproved", ["productId", "isApproved"])
    .index("by_userId", ["userId"])
    .index("by_userId_and_productId", ["userId", "productId"]),
});

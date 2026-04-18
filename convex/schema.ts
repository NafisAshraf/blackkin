import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── USERS (extended from existing) ────────────────────────
  users: defineTable({
    authUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()), // undefined for phone-only users
    phone: v.optional(v.string()), // set for users who signed up with mobile number
    role: v.union(v.literal("customer"), v.literal("admin"), v.literal("superadmin")),
    isActive: v.optional(v.boolean()), // undefined = active, false = deactivated
    permissions: v.optional(v.object({
      orders: v.optional(v.object({
        enabled: v.boolean(),
        allowedStatuses: v.array(v.string()),
        canEdit: v.boolean(),
        canDelete: v.boolean(),
        canConfirm: v.boolean(),
      })),
      marketing: v.boolean(),
      products: v.boolean(),
      settings: v.boolean(),
      pages: v.boolean(),
      users: v.boolean(),
    })),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_role", ["role"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"]),

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
    imageId: v.optional(v.string()),
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
    sku: v.string(), // unique product identifier, auto-generated
    description: v.string(),
    categoryId: v.optional(v.id("categories")),
    basePrice: v.number(), // "Regular Price" in BDT

    // Publishing status (replaces isActive)
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("scheduled"),
      v.literal("archived")
    ),
    scheduledPublishTime: v.optional(v.number()), // unix ms, used when status === "scheduled"

    // Individual sale pricing
    saleEnabled: v.boolean(), // master toggle
    salePrice: v.optional(v.number()), // sale price in BDT
    saleStartMode: v.union(v.literal("immediately"), v.literal("custom")),
    saleStartTime: v.optional(v.number()), // unix ms, when saleStartMode === "custom"
    saleEndMode: v.union(v.literal("indefinite"), v.literal("custom")),
    saleEndTime: v.optional(v.number()), // unix ms, when saleEndMode === "custom"
    saleDisplayMode: v.optional(v.union(v.literal("percentage"), v.literal("amount"))), // controls how discount is shown to customers

    // Display ordering
    globalSortOrder: v.number(), // catalog/shop page order
    categorySortOrder: v.number(), // within-category order
    saleDiscountSortOrder: v.optional(v.number()), // order on the "On Sale" page (individual discounts)

    totalRatings: v.number(), // denormalized count of approved reviews
    averageRating: v.number(), // denormalized average rating
    // SEO metadata
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),

    // Media stored inline - bounded list, well under 8192 limit
    media: v.array(
      v.object({
        storageId: v.string(),
        type: v.union(v.literal("image"), v.literal("video"), v.literal("model3d")),
        sortOrder: v.number(),
      })
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_sku", ["sku"])
    .index("by_categoryId", ["categoryId"])
    .index("by_status", ["status"])
    .index("by_status_and_globalSortOrder", ["status", "globalSortOrder"])
    .index("by_categoryId_and_categorySortOrder", ["categoryId", "categorySortOrder"])
    .index("by_saleEnabled_and_saleDiscountSortOrder", ["saleEnabled", "saleDiscountSortOrder"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["categoryId", "status"],
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
    sortOrder: v.number(), // ordering within a tag
  })
    .index("by_productId", ["productId"])
    .index("by_tagId", ["tagId"])
    .index("by_productId_and_tagId", ["productId", "tagId"])
    .index("by_tagId_and_sortOrder", ["tagId", "sortOrder"]),

  // ─── DISCOUNT GROUPS ──────────────────────────────────────
  discountGroups: defineTable({
    name: v.string(), // e.g. "Eid Dhamaka Offer"
    isActive: v.boolean(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountValue: v.number(), // percentage (0-100) or fixed BDT amount off
    startTime: v.number(), // unix ms
    endTime: v.optional(v.number()), // unix ms, undefined = indefinite
    sortOrder: v.number(), // display order on sale page (lower = first)
  })
    .index("by_isActive", ["isActive"])
    .index("by_sortOrder", ["sortOrder"]),

  // ─── DISCOUNT GROUP PRODUCTS (junction) ──────────────────
  discountGroupProducts: defineTable({
    groupId: v.id("discountGroups"),
    productId: v.id("products"),
    sortOrder: v.number(), // display order within this group
  })
    .index("by_groupId", ["groupId"])
    .index("by_productId", ["productId"])
    .index("by_groupId_and_productId", ["groupId", "productId"])
    .index("by_groupId_and_sortOrder", ["groupId", "sortOrder"]),

  // ─── PRODUCT RECOMMENDATIONS (admin-selected, GLOBAL) ────
  // "also_like" shows on ALL product pages. "also_bought" shows at checkout filtered by size.
  productRecommendations: defineTable({
    type: v.union(
      v.literal("also_like"),
      v.literal("also_bought")
    ),
    recommendedProductId: v.optional(v.id("products")), // used for also_like
    recommendedVariantId: v.optional(v.id("productVariants")), // used for also_bought (variant-based)
    forSize: v.optional(v.string()), // size category for also_bought sections
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
    address: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_type", ["userId", "type"]),

  // ─── ORDERS ───────────────────────────────────────────────
  orders: defineTable({
    orderNumber: v.number(),            // sequential human-readable number (e.g. 1001)
    userId: v.id("users"),
    status: v.union(
      v.literal("new"),
      v.literal("confirmed"),
      v.literal("ready_for_delivery"),
      v.literal("in_courier"),
      v.literal("cancelled"),
      v.literal("hold"),
      v.literal("ship_later"),
      v.literal("paid"),
      v.literal("deleted"),
      v.literal("completed")
    ),
    courierName: v.optional(v.string()),
    shippingAddress: v.object({
      name: v.string(),
      phone: v.string(),
      email: v.optional(v.string()),   // snapshot of customer email at order time
      address: v.string(),             // single free-text field
    }),
    subtotal: v.number(),
    discountAmount: v.number(),
    total: v.number(),
    deliveryCost: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("refunded")
    ),
    notes: v.optional(v.string()),
    adminNote: v.optional(v.string()), // single admin note (replaces chat-style orderNotes)
    confirmedBy: v.optional(v.object({ userId: v.id("users"), name: v.string(), at: v.number() })),
    deletedBy:   v.optional(v.object({ userId: v.id("users"), name: v.string(), at: v.number() })),
    cancelledBy: v.optional(v.object({ userId: v.id("users"), name: v.string(), at: v.number() })),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_userId_and_status", ["userId", "status"]),

  // ─── ORDER NOTES ──────────────────────────────────────────
  orderNotes: defineTable({
    orderId: v.id("orders"),
    adminId: v.id("users"),
    adminName: v.string(),
    text: v.string(),
  })
    .index("by_orderId", ["orderId"]),

  // ─── PAYMENTS (SSLCommerz transaction tracking) ───────────
  payments: defineTable({
    orderId: v.id("orders"),
    tranId: v.string(),                        // unique ID sent to SSLCommerz
    sessionKey: v.optional(v.string()),        // SSLCommerz sessionkey
    gatewayPageUrl: v.optional(v.string()),    // GatewayPageURL (for reference)
    status: v.union(
      v.literal("initiated"),   // session created, user redirected
      v.literal("valid"),       // IPN + validation confirmed
      v.literal("failed"),      // payment declined
      v.literal("cancelled"),   // customer cancelled
      v.literal("expired")      // timeout / unattempted
    ),
    amount: v.number(),                        // amount in BDT
    currency: v.string(),                      // "BDT"
    // Populated after IPN / validation
    valId: v.optional(v.string()),
    bankTranId: v.optional(v.string()),
    cardType: v.optional(v.string()),
    cardNo: v.optional(v.string()),
    cardBrand: v.optional(v.string()),
    storeAmount: v.optional(v.number()),
    riskLevel: v.optional(v.string()),
    riskTitle: v.optional(v.string()),
  })
    .index("by_tranId", ["tranId"])
    .index("by_orderId", ["orderId"]),

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

  // ─── LANDING PAGE CMS ─────────────────────────────────────
  // One row per image slot. Upserted by admin. Falls back to
  // static public-folder images on the frontend if absent.
  landingPageImages: defineTable({
    slot: v.union(
      v.literal("hero"),
      v.literal("splitImage"),
      v.literal("tech1"),
      v.literal("tech2"),
      v.literal("tech3")
    ),
    storageId: v.string(),
  }).index("by_slot", ["slot"]),

  // Testimonial quotes for the homepage carousel.
  landingPageQuotes: defineTable({
    text: v.string(),
    author: v.string(),
    isActive: v.boolean(),
  }).index("by_isActive", ["isActive"]),

  // ─── LANDING PAGE PRODUCT SECTIONS ────────────────────────
  // Two configurable product showcase sections (position 1 & 2).
  // Each has a heading and an ordered list of selected products.
  // Only shown on the landing page when isActive is true.
  landingPageProductSections: defineTable({
    position: v.union(v.literal(1), v.literal(2)), // 1 = below "Crafted for the Modern Man", 2 = below split section
    heading: v.string(),
    isActive: v.boolean(),
    tagId: v.optional(v.id("tags")),
  })
    .index("by_position", ["position"])
    .index("by_isActive", ["isActive"])
    .index("by_tagId", ["tagId"]),

  // Individual products selected for each product section.
  landingPageProductSectionItems: defineTable({
    sectionId: v.id("landingPageProductSections"),
    productId: v.id("products"),
    sortOrder: v.number(),
  })
    .index("by_sectionId", ["sectionId"])
    .index("by_sectionId_and_sortOrder", ["sectionId", "sortOrder"])
    .index("by_sectionId_and_productId", ["sectionId", "productId"])
    .index("by_productId", ["productId"]),

  // ─── MARKETING SETTINGS ───────────────────────────────────
  marketingSettings: defineTable({
    type: v.union(
      v.literal("facebook"),
      v.literal("google"),
      v.literal("seo"),
      v.literal("customScripts")
    ),
    config: v.any(),
  })
    .index("by_type", ["type"]),

  // ─── ORDER STATUS AMOUNTS ─────────────────────────────────
  orderStatusAmounts: defineTable({
    status: v.string(),
    totalAmount: v.number(),
  })
    .index("by_status", ["status"]),

  // ─── COUNTERS (generic auto-increment sequences) ──────────
  counters: defineTable({
    key: v.string(),   // e.g. "orderNumber"
    value: v.number(), // current highest value
  })
    .index("by_key", ["key"]),
});

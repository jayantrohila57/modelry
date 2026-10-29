import { relations } from "drizzle-orm";
import { bigint, boolean, customType, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

const vector768 = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector(768)",
  fromDriver: (value) => value.slice(1, -1).split(",").map(Number),
  toDriver: (value) => `[${value.join(",")}]`,
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").default(true).notNull(),
  failedVerificationCount: integer("failed_verification_count").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const passkey = pgTable("passkey", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull(),
  transports: text("transports"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  aaguid: text("aaguid"),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key"),
  count: integer("count"),
  lastRequest: bigint("last_request", { mode: "number" }),
});

export const media = pgTable("media", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  alt: text("alt"),
  type: text("type").$type<"image" | "video" | "model" | "file">().default("file"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const assetFolder = pgTable(
  "asset_folder",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => ({
    byUserNameUniqueIdx: uniqueIndex("asset_folder_user_name_unique_idx").on(table.userId, table.name),
    byUserCreatedIdx: index("asset_folder_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const chatThread = pgTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    titleSource: text("title_source").$type<"manual" | "auto">().default("auto").notNull(),
    model: text("model"),
    summary: text("summary"),
    summaryVersion: integer("summary_version").notNull().default(0),
    summaryUpdatedAt: timestamp("summary_updated_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    byUserLastMessageIdx: index("chat_thread_user_last_message_idx").on(table.userId, table.lastMessageAt),
    byUserDeletedIdx: index("chat_thread_user_deleted_idx").on(table.userId, table.deletedAt),
  }),
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    clientMessageId: text("client_message_id"),
    role: text("role").$type<"system" | "user" | "assistant" | "tool">().notNull(),
    status: text("status")
      .$type<"pending" | "streaming" | "completed" | "failed" | "cancelled">()
      .default("pending")
      .notNull(),
    content: text("content").notNull().default(""),
    model: text("model"),
    provider: text("provider"),
    reasoning: text("reasoning"),
    reasoningTokens: integer("reasoning_tokens").notNull().default(0),
    summaryVersionUsed: integer("summary_version_used").notNull().default(0),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    creditCost: integer("credit_cost").notNull().default(0),
    errorMessage: text("error_message"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    byThreadCreatedIdx: index("chat_message_thread_created_idx").on(table.threadId, table.createdAt),
    byThreadRoleIdx: index("chat_message_thread_role_idx").on(table.threadId, table.role),
    clientMessageUniqueIdx: uniqueIndex("chat_message_client_message_unique_idx").on(
      table.threadId,
      table.clientMessageId,
    ),
  }),
);

export const aiModel = pgTable(
  "ai_model",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerModel: text("provider_model").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    planCode: text("plan_code").notNull().default("free"),
    enabled: boolean("enabled").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    supportsReasoning: boolean("supports_reasoning").notNull().default(false),
    creditMultiplierBps: integer("credit_multiplier_bps").notNull().default(10000),
    contextWindow: integer("context_window"),
    maxOutputTokens: integer("max_output_tokens"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    providerModelUniqueIdx: uniqueIndex("ai_model_provider_model_unique_idx").on(table.provider, table.providerModel),
    planSortIdx: index("ai_model_plan_sort_idx").on(table.planCode, table.sortOrder),
  }),
);

export const chatAttachment = pgTable(
  "chat_attachment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: text("thread_id").references(() => chatThread.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => chatMessage.id, { onDelete: "set null" }),
    mediaId: text("media_id").references(() => media.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    status: text("status").$type<"uploaded" | "attached" | "orphaned" | "deleted">().default("uploaded").notNull(),
    pathname: text("pathname"),
    fileType: text("file_type").notNull().default("other"),
    category: text("category").notNull().default("Uncategorized"),
    folderId: text("folder_id").references(() => assetFolder.id, { onDelete: "set null" }),
    summary: text("summary"),
    extractedText: text("extracted_text"),
    extractedMetadata: jsonb("extracted_metadata").$type<Record<string, unknown>>(),
    processingStatus: text("processing_status")
      .$type<"queued" | "uploading" | "extracting" | "embedding" | "ready" | "failed">()
      .notNull()
      .default("queued"),
    processingProgress: integer("processing_progress").notNull().default(0),
    processingError: text("processing_error"),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    assetOwnerUnique: unique("chat_attachment_id_user_unique").on(table.id, table.userId),
    byUserIdx: index("chat_attachment_user_idx").on(table.userId, table.createdAt),
    byThreadIdx: index("chat_attachment_thread_idx").on(table.threadId, table.createdAt),
    byMessageIdx: index("chat_attachment_message_idx").on(table.messageId),
    byUserCategoryIdx: index("chat_attachment_user_category_idx").on(table.userId, table.category, table.createdAt),
    byUserFileTypeIdx: index("chat_attachment_user_file_type_idx").on(table.userId, table.fileType),
    byUserFolderIdx: index("chat_attachment_user_folder_idx").on(table.userId, table.folderId),
    byUserProcessingIdx: index("chat_attachment_user_processing_idx").on(table.userId, table.processingStatus),
  }),
);

export const assetChunk = pgTable(
  "asset_chunk",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .notNull(),
    userId: text("user_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector768("embedding").notNull(),
    ...timestamps,
  },
  (table) => ({
    assetOwnerFk: foreignKey({
      name: "asset_chunk_asset_owner_fk",
      columns: [table.assetId, table.userId],
      foreignColumns: [chatAttachment.id, chatAttachment.userId],
    }).onDelete("cascade"),
    assetChunkUniqueIdx: uniqueIndex("asset_chunk_asset_index_unique_idx").on(table.assetId, table.chunkIndex),
    byUserIdx: index("asset_chunk_user_idx").on(table.userId),
  }),
);

export const creditWallet = pgTable(
  "credit_wallet",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    balanceCredits: integer("balance_credits").notNull().default(0),
    lifetimeGrantedCredits: integer("lifetime_granted_credits").notNull().default(0),
    lifetimeSpentCredits: integer("lifetime_spent_credits").notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    userUniqueIdx: uniqueIndex("credit_wallet_user_unique_idx").on(table.userId),
  }),
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => creditWallet.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: text("thread_id").references(() => chatThread.id, { onDelete: "set null" }),
    messageId: text("message_id").references(() => chatMessage.id, { onDelete: "set null" }),
    kind: text("kind")
      .$type<
        | "starter_grant"
        | "reservation"
        | "settlement"
        | "refund"
        | "subscription_grant"
        | "purchase_grant"
        | "manual_adjustment"
      >()
      .notNull(),
    source: text("source").notNull(),
    sourceRef: text("source_ref"),
    deltaCredits: integer("delta_credits").notNull(),
    balanceAfterCredits: integer("balance_after_credits").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    byWalletCreatedIdx: index("credit_ledger_wallet_created_idx").on(table.walletId, table.createdAt),
    byUserCreatedIdx: index("credit_ledger_user_created_idx").on(table.userId, table.createdAt),
    byMessageIdx: index("credit_ledger_message_idx").on(table.messageId),
    sourceRefUniqueIdx: uniqueIndex("credit_ledger_source_ref_unique_idx").on(table.sourceRef),
  }),
);

export const usageEvent = pgTable(
  "usage_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: text("thread_id").references(() => chatThread.id, { onDelete: "set null" }),
    messageId: text("message_id").references(() => chatMessage.id, { onDelete: "set null" }),
    eventType: text("event_type")
      .$type<
        "chat_started" | "chat_completed" | "chat_failed" | "chat_cancelled" | "title_changed" | "thread_deleted"
      >()
      .notNull(),
    provider: text("provider"),
    model: text("model"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    creditCost: integer("credit_cost").notNull().default(0),
    status: text("status").notNull().default("recorded"),
    payload: text("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    byUserCreatedIdx: index("usage_event_user_created_idx").on(table.userId, table.createdAt),
    byThreadCreatedIdx: index("usage_event_thread_created_idx").on(table.threadId, table.createdAt),
    byMessageIdx: index("usage_event_message_idx").on(table.messageId),
  }),
);

export const subscriptionPlan = pgTable(
  "subscription_plan",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    creditsPerCycle: integer("credits_per_cycle").notNull().default(0),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    billingInterval: text("billing_interval").$type<"month" | "year" | "one_time">().default("month").notNull(),
    providerPlanId: text("provider_plan_id"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    codeUniqueIdx: uniqueIndex("subscription_plan_code_unique_idx").on(table.code),
    providerPlanUniqueIdx: uniqueIndex("subscription_plan_provider_plan_unique_idx").on(table.providerPlanId),
  }),
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => subscriptionPlan.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().default("razorpay"),
    providerSubscriptionId: text("provider_subscription_id"),
    status: text("status")
      .$type<"inactive" | "trialing" | "active" | "past_due" | "cancelled">()
      .default("inactive")
      .notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    byUserStatusIdx: index("subscription_user_status_idx").on(table.userId, table.status),
    providerSubscriptionUniqueIdx: uniqueIndex("subscription_provider_subscription_unique_idx").on(
      table.providerSubscriptionId,
    ),
  }),
);

export const paymentEvent = pgTable(
  "payment_event",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscription.id, { onDelete: "set null" }),
    provider: text("provider").notNull().default("razorpay"),
    providerEventId: text("provider_event_id"),
    eventType: text("event_type").notNull(),
    status: text("status").notNull().default("received"),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    payload: text("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerEventUniqueIdx: uniqueIndex("payment_event_provider_event_unique_idx").on(table.providerEventId),
    byUserCreatedIdx: index("payment_event_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const billingOrder = pgTable(
  "billing_order",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscription.id, { onDelete: "set null" }),
    planId: text("plan_id").references(() => subscriptionPlan.id, { onDelete: "set null" }),
    planCode: text("plan_code").notNull(),
    provider: text("provider").notNull().default("razorpay"),
    providerOrderId: text("provider_order_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    status: text("status")
      .$type<"created" | "authenticated" | "active" | "completed" | "cancelled" | "failed">()
      .default("created")
      .notNull(),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    notes: text("notes"),
    metadata: text("metadata"),
    ...timestamps,
  },
  (table) => ({
    byUserCreatedIdx: index("billing_order_user_created_idx").on(table.userId, table.createdAt),
    providerOrderUniqueIdx: uniqueIndex("billing_order_provider_order_unique_idx").on(table.providerOrderId),
    providerSubscriptionIdx: index("billing_order_provider_subscription_idx").on(table.providerSubscriptionId),
  }),
);

export const backgroundJobRun = pgTable(
  "background_job_run",
  {
    id: text("id").primaryKey(),
    jobKey: text("job_key").notNull(),
    jobType: text("job_type").notNull(),
    status: text("status").$type<"pending" | "running" | "completed" | "failed">().default("pending").notNull(),
    payload: text("payload"),
    result: text("result"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    jobKeyUniqueIdx: uniqueIndex("background_job_run_job_key_unique_idx").on(table.jobKey),
    byTypeStatusIdx: index("background_job_run_type_status_idx").on(table.jobType, table.status),
  }),
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  wallet: one(creditWallet, {
    fields: [user.id],
    references: [creditWallet.userId],
  }),
  threads: many(chatThread),
  subscriptions: many(subscription),
  assetFolders: many(assetFolder),
  assets: many(chatAttachment),
  assetChunks: many(assetChunk),
}));

export const assetFolderRelations = relations(assetFolder, ({ one, many }) => ({
  user: one(user, { fields: [assetFolder.userId], references: [user.id] }),
  assets: many(chatAttachment),
}));

export const assetChunkRelations = relations(assetChunk, ({ one }) => ({
  asset: one(chatAttachment, { fields: [assetChunk.assetId], references: [chatAttachment.id] }),
  user: one(user, { fields: [assetChunk.userId], references: [user.id] }),
}));

export const chatThreadRelations = relations(chatThread, ({ one, many }) => ({
  user: one(user, {
    fields: [chatThread.userId],
    references: [user.id],
  }),
  messages: many(chatMessage),
  attachments: many(chatAttachment),
}));

export const chatMessageRelations = relations(chatMessage, ({ one, many }) => ({
  thread: one(chatThread, {
    fields: [chatMessage.threadId],
    references: [chatThread.id],
  }),
  author: one(user, {
    fields: [chatMessage.userId],
    references: [user.id],
  }),
  attachments: many(chatAttachment),
}));

export const chatAttachmentRelations = relations(chatAttachment, ({ one, many }) => ({
  user: one(user, {
    fields: [chatAttachment.userId],
    references: [user.id],
  }),
  thread: one(chatThread, {
    fields: [chatAttachment.threadId],
    references: [chatThread.id],
  }),
  message: one(chatMessage, {
    fields: [chatAttachment.messageId],
    references: [chatMessage.id],
  }),
  media: one(media, {
    fields: [chatAttachment.mediaId],
    references: [media.id],
  }),
  folder: one(assetFolder, { fields: [chatAttachment.folderId], references: [assetFolder.id] }),
  chunks: many(assetChunk),
}));

export const creditWalletRelations = relations(creditWallet, ({ one, many }) => ({
  user: one(user, {
    fields: [creditWallet.userId],
    references: [user.id],
  }),
  ledgerEntries: many(creditLedger),
}));

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
  wallet: one(creditWallet, {
    fields: [creditLedger.walletId],
    references: [creditWallet.id],
  }),
  user: one(user, {
    fields: [creditLedger.userId],
    references: [user.id],
  }),
  thread: one(chatThread, {
    fields: [creditLedger.threadId],
    references: [chatThread.id],
  }),
  message: one(chatMessage, {
    fields: [creditLedger.messageId],
    references: [chatMessage.id],
  }),
}));

export const usageEventRelations = relations(usageEvent, ({ one }) => ({
  user: one(user, {
    fields: [usageEvent.userId],
    references: [user.id],
  }),
  thread: one(chatThread, {
    fields: [usageEvent.threadId],
    references: [chatThread.id],
  }),
  message: one(chatMessage, {
    fields: [usageEvent.messageId],
    references: [chatMessage.id],
  }),
}));

export const aiModelRelations = relations(aiModel, () => ({}));

export const subscriptionPlanRelations = relations(subscriptionPlan, ({ many }) => ({
  subscriptions: many(subscription),
}));

export const subscriptionRelations = relations(subscription, ({ one, many }) => ({
  user: one(user, {
    fields: [subscription.userId],
    references: [user.id],
  }),
  plan: one(subscriptionPlan, {
    fields: [subscription.planId],
    references: [subscriptionPlan.id],
  }),
  paymentEvents: many(paymentEvent),
}));

export const paymentEventRelations = relations(paymentEvent, ({ one }) => ({
  user: one(user, {
    fields: [paymentEvent.userId],
    references: [user.id],
  }),
  subscription: one(subscription, {
    fields: [paymentEvent.subscriptionId],
    references: [subscription.id],
  }),
}));

export const billingOrderRelations = relations(billingOrder, ({ one }) => ({
  user: one(user, {
    fields: [billingOrder.userId],
    references: [user.id],
  }),
  subscription: one(subscription, {
    fields: [billingOrder.subscriptionId],
    references: [subscription.id],
  }),
  plan: one(subscriptionPlan, {
    fields: [billingOrder.planId],
    references: [subscriptionPlan.id],
  }),
}));

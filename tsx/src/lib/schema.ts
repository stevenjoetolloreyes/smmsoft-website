import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const ms = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    apiKey: text("api_key").notNull(),
    credits: integer("credits").notNull().default(0),
    isAdmin: integer("is_admin").notNull().default(0),
    status: text("status").notNull().default("active"), // active | suspended
    createdAt: ms(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email), uniqueIndex("users_api_key_unique").on(t.apiKey)],
);

export const creditTransactions = sqliteTable(
  "credit_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    type: text("type").notNull(), // purchase | send | refund | adjust
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    note: text("note"),
    createdAt: ms(),
  },
  (t) => [index("credit_transactions_user_idx").on(t.userId)],
);

export const topups = sqliteTable(
  "topups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    creditsWanted: integer("credits_wanted").notNull(),
    amountPeso: real("amount_peso").notNull(),
    payRef: text("pay_ref"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    createdAt: ms(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("topups_user_idx").on(t.userId), index("topups_status_idx").on(t.status)],
);

export const smsMessages = sqliteTable(
  "sms_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    semaphoreId: integer("semaphore_id"),
    recipient: text("recipient").notNull(),
    message: text("message").notNull(),
    senderName: text("sender_name"),
    network: text("network"),
    status: text("status").notNull().default("Queued"),
    msgType: text("msg_type").notNull().default("Single"),
    kind: text("kind").notNull().default("regular"),
    creditsCharged: integer("credits_charged").notNull().default(0),
    source: text("source").notNull().default("web"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("sms_messages_user_idx").on(t.userId),
    index("sms_messages_status_idx").on(t.status),
    index("sms_messages_semaphore_idx").on(t.semaphoreId),
  ],
);

export const smsContacts = sqliteTable(
  "sms_contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    name: text("name").notNull(),
    number: text("number").notNull(),
    groupName: text("group_name").notNull().default("General"),
    createdAt: ms(),
  },
  (t) => [index("sms_contacts_user_idx").on(t.userId), index("sms_contacts_group_idx").on(t.groupName)],
);

export const smsSenders = sqliteTable(
  "sms_senders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    isDefault: integer("is_default").notNull().default(0),
    createdAt: ms(),
  },
  (t) => [uniqueIndex("sms_senders_name_unique").on(t.name)],
);

export const smsSettings = sqliteTable("sms_settings", {
  k: text("k").primaryKey(),
  v: text("v"),
});

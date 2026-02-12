CREATE TABLE "budget_income_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"income_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"from_account" text,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"auto_tagged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "akahu_transaction" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "budget_income" ADD COLUMN "reference_date_payday" timestamp;--> statement-breakpoint
ALTER TABLE "budget_income" ADD COLUMN "adjust_for_weekends" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "budget_income" ADD COLUMN "next_payday_date" timestamp;--> statement-breakpoint
ALTER TABLE "budget_income" ADD COLUMN "expected_from_account" text;--> statement-breakpoint
ALTER TABLE "budget_income" ADD COLUMN "auto_tag_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "budget_income_transaction" ADD CONSTRAINT "budget_income_transaction_income_id_budget_income_id_fk" FOREIGN KEY ("income_id") REFERENCES "public"."budget_income"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_income_transaction" ADD CONSTRAINT "budget_income_transaction_transaction_id_akahu_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."akahu_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bit_income_id" ON "budget_income_transaction"("income_id");--> statement-breakpoint
CREATE INDEX "idx_bit_transaction_id" ON "budget_income_transaction"("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_bit_from_account" ON "budget_income_transaction"("from_account");--> statement-breakpoint
CREATE INDEX "idx_at_meta_other_account" ON "akahu_transaction" USING gin ((meta->'other_account'));

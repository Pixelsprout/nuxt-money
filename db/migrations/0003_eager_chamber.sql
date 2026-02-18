CREATE TABLE "transaction_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"merchant" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"from_account" text DEFAULT '' NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_reference" ADD CONSTRAINT "transaction_reference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reference" ADD CONSTRAINT "transaction_reference_category_id_transaction_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."transaction_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_transaction_reference_unique" ON "transaction_reference" USING btree ("user_id","merchant","description","from_account");
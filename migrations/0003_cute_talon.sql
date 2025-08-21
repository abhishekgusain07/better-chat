CREATE TABLE "auto_approval_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"read_only_operations" boolean DEFAULT false,
	"low_risk_operations" boolean DEFAULT false,
	"specific_tools" jsonb DEFAULT '{}',
	"max_cost_per_tool" numeric(10, 4) DEFAULT '1.00',
	"max_cost_per_hour" numeric(10, 4) DEFAULT '10.00',
	"require_approval_for_new_tools" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "auto_approval_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "context_optimizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"trigger_reason" varchar(50) NOT NULL,
	"optimization_type" varchar(50) NOT NULL,
	"tokens_before" integer NOT NULL,
	"tokens_after" integer NOT NULL,
	"summary" text,
	"affected_messages" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(500),
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"system_prompt" text,
	"context_window_size" integer DEFAULT 8192,
	"auto_approval_settings" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"content_hash" varchar(64),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"images" jsonb DEFAULT '[]',
	"files" jsonb DEFAULT '[]',
	"token_count" integer,
	"provider_metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" varchar(50) NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tool_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"parameters" jsonb NOT NULL,
	"result" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approval_requested_at" timestamp,
	"approved_at" timestamp,
	"executed_at" timestamp,
	"completed_at" timestamp,
	"execution_time_ms" integer,
	"cost" numeric(10, 4),
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost" numeric(10, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "auto_approval_settings" ADD CONSTRAINT "auto_approval_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_optimizations" ADD CONSTRAINT "context_optimizations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_context_optimizations_conversation_id" ON "context_optimizations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_context_optimizations_created_at" ON "context_optimizations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_conversations_user_id" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_created_at" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_file_uploads_user_id" ON "file_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_file_uploads_conversation_id" ON "file_uploads" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_file_uploads_content_hash" ON "file_uploads" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_created" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_provider_configs_user_id" ON "provider_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "unique_user_provider" ON "provider_configs" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "idx_tool_executions_conversation_id" ON "tool_executions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_tool_executions_status" ON "tool_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tool_executions_tool_name" ON "tool_executions" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "idx_tool_executions_status_created" ON "tool_executions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_user_id" ON "usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_created_at" ON "usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_provider" ON "usage_logs" USING btree ("provider");
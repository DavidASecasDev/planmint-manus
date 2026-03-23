/**
 * POST /api/apply-template
 * Migrated from Supabase Edge Function apply-template.
 * Applies a template configuration to the user's organization.
 */
import type { Request, Response } from "express";
import { getServiceClient, authenticateSupabaseRequest, AuthError } from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

interface TemplateConfig {
  areas?: Array<{ name: string; color?: string; icon?: string }>;
  tags?: Array<{ name: string; color?: string }>;
  tasks?: Array<{
    title: string;
    description?: string;
    priority?: string;
    area?: string;
    tags?: string[];
  }>;
  kanban_columns?: Array<{ name: string; position: number; color?: string }>;
  automation_rules?: Array<{
    name: string;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    action_type: string;
    action_config: Record<string, unknown>;
  }>;
}

export async function handleApplyTemplate(req: Request, res: Response) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { userId, organizationId } = await authenticateSupabaseRequest(req.headers.authorization);
    const { version_id, user_template_id, options } = req.body || {};
    const serviceClient = getServiceClient();

    // Check permission to apply templates (respects role + custom role + user overrides)
    const { allowed: canApply } = await checkUserPermission(
      serviceClient, organizationId, userId, "templates.apply"
    );
    if (!canApply) {
      return res.status(403).json({ success: false, error: "No permission to apply templates" });
    }

    if (!version_id && !user_template_id) {
      return res.status(400).json({ success: false, error: "version_id or user_template_id is required" });
    }
    let config: TemplateConfig | null = null;

    if (user_template_id) {
      // Load user template
      const { data: userTemplate, error } = await serviceClient
        .from("user_templates")
        .select("config_json")
        .eq("id", user_template_id)
        .eq("organization_id", organizationId)
        .single();

      if (error || !userTemplate) {
        return res.json({ success: false, error: "Template not found" });
      }
      config = userTemplate.config_json as TemplateConfig;
    } else {
      // Load system template version
      const { data: version, error } = await serviceClient
        .from("template_versions")
        .select("config_json")
        .eq("id", version_id)
        .single();

      if (error || !version) {
        return res.json({ success: false, error: "Template version not found" });
      }
      config = version.config_json as TemplateConfig;
    }

    if (!config) {
      return res.json({ success: false, error: "Template config is empty" });
    }

    const applied: Record<string, number> = {};

    // Apply areas
    if (config.areas?.length) {
      for (const area of config.areas) {
        const { error } = await serviceClient.from("areas").insert({
          name: area.name,
          color: area.color || "#3B82F6",
          icon: area.icon || "folder",
          organization_id: organizationId,
          created_by: userId,
        });
        if (!error) applied.areas = (applied.areas || 0) + 1;
      }
    }

    // Apply tags
    if (config.tags?.length) {
      for (const tag of config.tags) {
        const { error } = await serviceClient.from("tags").insert({
          name: tag.name,
          color: tag.color || "#6B7280",
          organization_id: organizationId,
          created_by: userId,
        });
        if (!error) applied.tags = (applied.tags || 0) + 1;
      }
    }

    // Apply kanban columns
    if (config.kanban_columns?.length) {
      for (const col of config.kanban_columns) {
        const { error } = await serviceClient.from("kanban_columns").insert({
          name: col.name,
          position: col.position,
          color: col.color || "#3B82F6",
          organization_id: organizationId,
          created_by: userId,
        });
        if (!error) applied.kanban_columns = (applied.kanban_columns || 0) + 1;
      }
    }

    // Apply tasks
    if (config.tasks?.length) {
      for (const task of config.tasks) {
        const { error } = await serviceClient.from("tasks").insert({
          title: task.title,
          description: task.description || "",
          priority: task.priority || "medium",
          status: "pending",
          organization_id: organizationId,
          created_by: userId,
        });
        if (!error) applied.tasks = (applied.tasks || 0) + 1;
      }
    }

    // Apply automation rules
    if (config.automation_rules?.length) {
      for (const rule of config.automation_rules) {
        const { error } = await serviceClient.from("automation_rules").insert({
          name: rule.name,
          trigger_type: rule.trigger_type,
          trigger_config: rule.trigger_config,
          action_type: rule.action_type,
          action_config: rule.action_config,
          organization_id: organizationId,
          created_by: userId,
          is_active: true,
        });
        if (!error) applied.automation_rules = (applied.automation_rules || 0) + 1;
      }
    }

    // Record the template application
    await serviceClient.from("template_applies").insert({
      template_version_id: version_id || null,
      user_template_id: user_template_id || null,
      organization_id: organizationId,
      applied_by: userId,
      applied_entities: applied,
    });

    return res.json({ success: true, applied });
  } catch (error: any) {
    console.error("[apply-template] Error:", error);
    const status = error instanceof AuthError ? error.status : 500;
    return res.status(status).json({ success: false, error: error?.message || "Error desconocido" });
  }
}

/**
 * POST /api/create-user
 * Creates a user directly with email + password + name + role.
 * No invitation flow needed — the user can login immediately.
 *
 * Requires the caller to have "members.create" permission.
 */
import type { Request, Response } from "express";
import {
  authenticateSupabaseRequest,
  AuthError,
  getServiceClient,
} from "./supabaseAdmin";
import { checkUserPermission } from "./permissionHelper";

const VALID_ROLES = ["owner", "admin", "manager", "member", "read_only"];

export async function handleCreateUser(req: Request, res: Response) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // 1. Authenticate the caller
    const { userId, organizationId } = await authenticateSupabaseRequest(
      req.headers.authorization
    );

    // 2. Check permission
    const serviceClient = getServiceClient();
    const { allowed } = await checkUserPermission(
      serviceClient,
      organizationId,
      userId,
      "members.create"
    );
    if (!allowed) {
      return res.json({
        success: false,
        error: "insufficient_permissions",
      });
    }

    // 3. Validate inputs
    const { email, password, name, role } = req.body || {};

    if (!email || typeof email !== "string") {
      return res.json({ success: false, error: "missing_email" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.json({ success: false, error: "invalid_password" });
    }
    if (!name || typeof name !== "string") {
      return res.json({ success: false, error: "missing_name" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = (role || "member").toLowerCase();

    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.json({ success: false, error: "invalid_role" });
    }

    // 4. Check if user already exists as a member
    const { data: authUsers } = await serviceClient.auth.admin.listUsers();
    const existingUser = authUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      const { data: existingMember } = await serviceClient
        .from("organization_members")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingMember) {
        return res.json({ success: false, error: "already_member" });
      }
    }

    // 5. Create user in Supabase Auth (or add existing to org)
    let newUserId: string;

    if (existingUser) {
      // User exists in auth but not in this org — add them
      newUserId = existingUser.id;

      // Update their password if provided
      await serviceClient.auth.admin.updateUserById(newUserId, { password });
    } else {
      // Create brand new user
      const { data: signUpData, error: signUpError } =
        await serviceClient.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            name: name.trim(),
            organization_id: organizationId,
            role: normalizedRole,
          },
        });

      if (signUpError) {
        console.error("[create-user] Auth createUser error:", signUpError);
        return res.json({
          success: false,
          error: "creation_failed",
          message: signUpError.message,
        });
      }

      newUserId = signUpData.user?.id || "";
      if (!newUserId) {
        return res.json({
          success: false,
          error: "creation_failed",
          message: "No user ID returned",
        });
      }
    }

    // 6. Ensure profile exists with correct data
    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        name: name.trim(),
        organization_id: organizationId,
        role: normalizedRole,
      })
      .eq("id", newUserId);

    if (profileError) {
      // Profile might not exist yet (trigger race condition) — insert
      const { error: insertError } = await serviceClient
        .from("profiles")
        .insert({
          id: newUserId,
          name: name.trim(),
          organization_id: organizationId,
          role: normalizedRole,
        });

      if (insertError) {
        console.error("[create-user] Profile insert fallback error:", insertError);
      }
    }

    // 7. Add to organization_members
    const { error: memberError } = await serviceClient
      .from("organization_members")
      .upsert({
        user_id: newUserId,
        organization_id: organizationId,
        role: normalizedRole,
        status: "active",
      });

    if (memberError) {
      console.error("[create-user] Member upsert error:", memberError);
      return res.json({
        success: false,
        error: "member_creation_failed",
        message: memberError.message,
      });
    }

    return res.json({
      success: true,
      userId: newUserId,
      email: normalizedEmail,
      name: name.trim(),
      role: normalizedRole,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      });
    }
    console.error("[create-user] Error:", error);
    return res.status(500).json({
      success: false,
      error: "server_error",
      message: error?.message || "Error desconocido",
    });
  }
}

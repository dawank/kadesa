import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Konfigurasi server backend belum lengkap." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verifikasi otorisasi pemanggil melalui JWT sesi
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Sesi otorisasi tidak ditemukan." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseCaller = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await supabaseCaller.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, message: "Sesi autentikasi tidak valid atau telah berakhir." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Ambil profil pemanggil dari tabel public.users
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id, role, nama")
      .eq("auth_user_id", callerUser.id)
      .maybeSingle();

    if (profileErr || !callerProfile) {
      return new Response(
        JSON.stringify({ success: false, message: "Profil pengguna pemanggil tidak ditemukan di sistem." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerRole = callerProfile.role;
    if (callerRole !== "SUPER_ADMIN" && callerRole !== "OPERATOR_DESA") {
      return new Response(
        JSON.stringify({ success: false, message: "Hanya Super Admin atau Operator Desa yang berwenang mereset kata sandi aparatur." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Baca dan validasi payload
    const body = await req.json();
    const { targetUserId, newPassword } = body;

    if (!targetUserId || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, message: "Target pengguna dan kata sandi baru wajib disertakan." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof newPassword !== "string" || newPassword.trim().length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: "Kata sandi baru minimal 6 karakter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Ambil target user dari public.users
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from("users")
      .select("id, auth_user_id, username, nama, role")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetErr || !targetUser) {
      return new Response(
        JSON.stringify({ success: false, message: "Data aparatur target tidak ditemukan." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Validasi batasan hak akses reset:
    // Operator tidak boleh mereset kata sandi Super Admin
    if (callerRole === "OPERATOR_DESA" && targetUser.role === "SUPER_ADMIN") {
      return new Response(
        JSON.stringify({ success: false, message: "Operator tidak memiliki wewenang untuk mereset kata sandi akun Super Admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Operator tidak boleh mereset kata sandi miliknya sendiri via admin reset
    if (callerRole === "OPERATOR_DESA" && callerProfile.id === targetUserId) {
      return new Response(
        JSON.stringify({ success: false, message: "Gunakan menu Profil Saya untuk memperbarui kata sandi akun Anda sendiri." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetUser.auth_user_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Akun target belum memiliki identitas Supabase Auth." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Reset password menggunakan Supabase Auth Admin API
    const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.auth_user_id,
      { password: newPassword.trim() }
    );

    if (authUpdateErr) {
      return new Response(
        JSON.stringify({ success: false, message: "Gagal memperbarui kata sandi di sistem autentikasi: " + authUpdateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Catat audit event ke audit_logs
    try {
      await supabaseAdmin.from("audit_logs").insert({
        id: `aud-${Date.now().toString().slice(-5)}`,
        actor_user_id: callerProfile.id,
        actor_name: callerProfile.nama || callerRole,
        actor_role: callerRole,
        action: "MASTER_UPDATED",
        entity_type: "USER_PASSWORD_RESET",
        entity_id: targetUserId,
        details: {
          reason: `Reset kata sandi aparatur: ${targetUser.nama} (@${targetUser.username}) oleh ${callerProfile.nama || callerRole}`,
          targetUsername: targetUser.username,
        },
      });
    } catch (_auditErr) {
      // Non-blocking jika audit log insert mengalami kendala
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Kata sandi untuk ${targetUser.nama} berhasil direset.`,
        data: { userId: targetUser.id, username: targetUser.username }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ success: false, message: "Terjadi kesalahan internal pada server." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

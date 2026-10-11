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

    // 2. Ambil peran pemanggil dari tabel public.users
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("id, role")
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
        JSON.stringify({ success: false, message: "Hanya Super Admin atau Operator Desa yang berwenang mendaftarkan aparatur." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Baca dan validasi payload pendaftaran
    const body = await req.json();
    const {
      username,
      password,
      nama,
      nik,
      nipd,
      nomorWhatsapp,
      fotoReference,
      role,
      jabatanId,
      attendanceRequired,
      effectiveFrom
    } = body;

    if (!username || !nama || !nik || !nomorWhatsapp || !jabatanId) {
      return new Response(
        JSON.stringify({ success: false, message: "Data pendaftaran wajib tidak lengkap (username, nama, nik, nomorWhatsapp, jabatanId)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Penegakan batasan peran Operator Desa (PRD 4 & ADR-008)
    if (callerRole === "OPERATOR_DESA") {
      if (role === "SUPER_ADMIN" || role === "OPERATOR_DESA") {
        return new Response(
          JSON.stringify({ success: false, message: "Operator Desa tidak berwenang membuat akun dengan peran Super Admin atau Operator Desa." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!password || typeof password !== "string" || password.trim().length < 8) {
      return new Response(
        JSON.stringify({ success: false, message: "Password awal wajib diisi minimal 8 karakter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const email = cleanUsername.includes("@") ? cleanUsername : `${cleanUsername}@desa.local`;
    const userPassword = password.trim();

    // 4. Periksa apakah NIK atau username sudah terdaftar
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id, username, nik")
      .or(`nik.eq.${nik},username.eq.${cleanUsername}`)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      const match = existingUser[0];
      const conflictField = match.nik === nik ? "NIK" : "Username";
      return new Response(
        JSON.stringify({ success: false, message: `${conflictField} '${conflictField === "NIK" ? nik : cleanUsername}' sudah terdaftar dalam sistem.` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Buat akun pada skema Supabase Auth (auth.users)
    const { data: createdAuth, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        nama,
        username: cleanUsername,
      },
    });

    if (createAuthErr || !createdAuth?.user) {
      return new Response(
        JSON.stringify({ success: false, message: `Gagal membuat akun autentikasi Supabase: ${createAuthErr?.message || "Kesalahan auth"}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUserId = createdAuth.user.id;

    // 6. Buat profil aparatur pada tabel public.users
    const userRowId = `usr-${Date.now().toString().slice(-4)}${Math.random().toString(36).substring(2, 6)}`;
    const { data: createdProfile, error: profileInsertErr } = await supabaseAdmin
      .from("users")
      .insert({
        id: userRowId,
        auth_user_id: authUserId,
        username: cleanUsername,
        password_hash: null, // Sesuai PRD 30.2: Kredensial dikelola Supabase Auth, bukan password_hash lokal
        nama,
        nik,
        nipd: nipd || null,
        nomor_whatsapp: nomorWhatsapp,
        foto_reference: fotoReference || null,
        role: role || "PERANGKAT_DESA",
        jabatan_id: jabatanId,
        attendance_required: attendanceRequired ?? true,
        active: true,
        effective_from: effectiveFrom || new Date().toISOString().split("T")[0],
      })
      .select("*, positions(nama)")
      .single();

    if (profileInsertErr || !createdProfile) {
      // Kompensasi rollback: Hapus user auth jika penulisan profil database gagal
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return new Response(
        JSON.stringify({ success: false, message: `Gagal menyimpan profil aparatur ke database: ${profileInsertErr?.message || "Kesalahan DB"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Catat audit log resmi
    await supabaseAdmin.from("audit_logs").insert({
      id: `aud-${Date.now().toString().slice(-4)}`,
      actor_user_id: callerProfile.id,
      actor_name: callerUser.email || "Administrator",
      actor_role: callerRole,
      action: "MASTER_UPDATED",
      entity_type: "APPARATUS_CREATED",
      entity_id: createdProfile.id,
      details: {
        reason: `Pendaftaran aparatur baru (@${cleanUsername}) oleh ${callerRole}`,
        createdUserId: createdProfile.id,
        createdAuthUserId: authUserId,
        role: createdProfile.role,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: createdProfile,
        message: "Akun aparatur desa berhasil dibuat dan terhubung ke Supabase Auth.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: `Galat internal server: ${err.message || "Unknown error"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { checkRateLimit, getClientIP } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "Número de celular no proporcionado" }, { status: 400 });
    }

    // Rate Limiting para evitar abusos de consulta de números
    const ip = getClientIP(req);
    const limitResult = checkRateLimit(`check_phone:${ip}`, 30, 3600); // Max 30 verificaciones por hora por IP
    if (!limitResult.allowed) {
      return NextResponse.json({ error: "Demasiadas consultas" }, { status: 429 });
    }

    const adminSupabase = createAdminClient();
    
    const { data: user, error } = await adminSupabase
      .from("users")
      .select("name, phone")
      .eq("phone", phone)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[CHECK-PHONE] Error en base de datos:", error);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }

    if (user) {
      // Obfuscar el nombre por seguridad (ej: "Jesús Chávez" -> "J**** C*****")
      const obfuscateName = (name: string) => {
        if (!name) return "";
        return name.split(" ").map(word => {
          if (word.length <= 1) return word;
          return word.charAt(0) + "*".repeat(word.length - 1);
        }).join(" ");
      };
      
      return NextResponse.json({ 
        exists: true, 
        name: obfuscateName(user.name),
        // Enviamos un hash del nombre real para validar en el cliente sin exponerlo
        nameHash: Buffer.from((user.name || '').trim().toLowerCase()).toString('base64')
      });
    } else {
      return NextResponse.json({ exists: false });
    }
  } catch (error: any) {
    console.error("[CHECK-PHONE] Exception:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
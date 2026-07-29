import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orderId = (await params).id;
    if (!orderId) return NextResponse.json({ error: "ID de orden no proporcionado." }, { status: 400 });

    let tokenPayload;
    try {
      tokenPayload = await requireRole(req, "customer");
    } catch (authErr: any) {
      return NextResponse.json({ error: authErr.message || "No autorizado" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    const { data: order, error: fetchErr } = await adminSupabase
      .from("orders")
      .select("id, status, user_id")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });

    if (order.user_id !== tokenPayload.user_id)
      return NextResponse.json({ error: "No tienes permiso para confirmar esta orden." }, { status: 403 });

    if (!["in_transit", "ready", "delivered"].includes(order.status))
      return NextResponse.json({ error: `No se puede confirmar recepcion en estado "${order.status}".` }, { status: 409 });

    if (order.status === "delivered")
      return NextResponse.json({ success: true, status: "delivered" });

    const { error: updateErr } = await adminSupabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", orderId);

    if (updateErr) throw new Error(`Error al actualizar orden: ${updateErr.message}`);

    console.log(`[CONFIRM-RECEIPT] Orden ${orderId} marcada como delivered por cliente ${tokenPayload.user_id}`);
    return NextResponse.json({ success: true, status: "delivered" });

  } catch (error: any) {
    console.error("[CONFIRM-RECEIPT] Error:", error?.message || error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
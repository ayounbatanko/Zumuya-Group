// Edge Function : envoie une notification Web Push au client / livreur / restaurant concerné par un changement de statut.
// Déploiement :  supabase functions deploy push-notify
// Secrets : supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:vous@exemple.com
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const LABEL: Record<string, string> = {
  "acceptée": "Votre commande a été acceptée ✅", "préparée": "Votre commande est prête 👨‍🍳",
  "colis récupéré": "Le livreur a récupéré votre commande 📦", "en route": "Votre commande est en route 🛵",
  "arrivé": "Le livreur est arrivé 📍", "terminée": "Commande livrée 🎉", "refusée": "Commande refusée", "annulée": "Commande annulée",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { orderId, status } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);

    const { data: o } = await sb.from("rg_orders").select("data").eq("id", orderId).maybeSingle();
    if (!o) return new Response(JSON.stringify({ ok: false }), { status: 404, headers: cors });
    const order = o.data;
    const ids = [order.clientId, order.driverId].filter(Boolean);
    const { data: users } = await sb.from("rg_users").select("data").in("id", ids.map(String));
    const body = LABEL[status] ?? `Statut : ${status}`;
    let sent = 0;
    for (const u of users ?? []) {
      const sub = u.data?.push; if (!sub) continue;
      try { await webpush.sendNotification(sub, JSON.stringify({ title: "Service de Restauration", body })); sent++; } catch (_) { /* abonnement expiré */ }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: cors });
  }
});

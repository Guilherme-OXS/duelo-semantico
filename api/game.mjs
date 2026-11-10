import { dispatchGameAction } from "../server/game-core.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Duelo-Backend": "1"
};

export async function POST(request) {
  try {
    const body = await request.json();
    const res = await dispatchGameAction(body);
    return new Response(JSON.stringify(res.payload), {
      status: res.status || 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error("[DUELO API] Falha ao processar acao:", err && err.message ? err.message : err);
    return new Response(
      JSON.stringify({ ok: false, error: "Erro ao processar requisicao." }),
      { status: 400, headers: JSON_HEADERS }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ ok: false, error: "Method Not Allowed" }),
    { status: 405, headers: JSON_HEADERS }
  );
}

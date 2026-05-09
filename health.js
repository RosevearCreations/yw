// functions/api/health.js
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet(context) {
  const started = Date.now();

  // D1 binding from Pages -> Settings -> Functions -> Bindings
  const db = context.env.DD_DB;
  if (!db) {
    return json(
      {
        ok: false,
        error:
          "Missing D1 binding: DD_DB. In Cloudflare Pages: Settings -> Functions -> Bindings -> add D1 binding named DD_DB.",
      },
      500
    );
  }

  try {
    // Works even with zero tables
    const row = await db.prepare("SELECT 1 AS ok").first();

    return json({
      ok: true,
      d1: row?.ok === 1,
      ms: Date.now() - started,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: String(err?.message || err),
        ms: Date.now() - started,
      },
      500
    );
  }
}

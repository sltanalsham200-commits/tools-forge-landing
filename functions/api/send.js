export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await context.request.json();
        const { text } = body;

        if (!text) {
            return new Response(JSON.stringify({ error: 'Missing text' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const BOT_TOKEN = context.env.BOT_TOKEN;
        const CHAT_ID = context.env.CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            return new Response(JSON.stringify({ error: 'Server not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const tgResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'HTML'
            })
        });

        if (!tgResponse.ok) {
            const errorText = await tgResponse.text();
            return new Response(JSON.stringify({ error: errorText }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

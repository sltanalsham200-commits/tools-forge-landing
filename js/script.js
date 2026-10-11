function openDrawer() {
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

function showSection(id) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
function navigate(id) {
    closeDrawer();
    setTimeout(() => showSection(id), 200);
}

function showToast(msg, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = isError ? '#e74c3c' : '#00c6ff';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function sendMessage(text) {
    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const type = document.getElementById('type').value;
    const msg = document.getElementById('message').value.trim();

    const text = `📬 <b>رسالة جديدة من Tools Forge</b>\n\n👤 الاسم: ${name}\n📧 البريد: ${email}\n📌 النوع: ${type}\n\n📝 الرسالة:\n${msg}`;

    const ok = await sendMessage(text);
    showToast(ok ? '✅ تم إرسال رسالتك بنجاح!' : '❌ حدث خطأ، حاول مرة أخرى.', !ok);
    if (ok) document.getElementById('contactForm').reset();
});

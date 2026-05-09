document.addEventListener('DOMContentLoaded', () => {
  const messageEl = document.getElementById('accountHelpMessage');
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const forgotEmailForm = document.getElementById('forgotEmailForm');

  function setMessage(text, isError = false) {
    if (!messageEl) return;
    messageEl.style.display = text ? '' : 'none';
    messageEl.textContent = text || '';
    messageEl.style.color = isError ? '#ff9b9b' : '';
  }

  async function submitRequest(requestType, form) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.request_type = requestType;
    setMessage('');
    const response = await fetch('/api/auth/account-help-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'Could not submit your request.');
    }
    form.reset();
    setMessage(data.message || 'Your request has been submitted.');
  }

  forgotPasswordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await submitRequest('forgot_password', forgotPasswordForm); }
    catch (error) { setMessage(error.message || 'Could not submit your request.', true); }
  });

  forgotEmailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await submitRequest('forgot_email', forgotEmailForm); }
    catch (error) { setMessage(error.message || 'Could not submit your request.', true); }
  });

  if (mode === 'password') {
    forgotPasswordForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (mode === 'email') {
    forgotEmailForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

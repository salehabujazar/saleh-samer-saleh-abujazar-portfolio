const form = document.querySelector('#login-form');
const message = document.querySelector('#message');
form.addEventListener('submit', async event => {
  event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; message.textContent = 'Signing in…';
  try {
    const session = await fetch('/api/auth/session').then(response => response.json());
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    location.assign('/admin');
  } catch (error) { message.textContent = error.message || 'Unable to sign in.'; }
  finally { button.disabled = false; }
});

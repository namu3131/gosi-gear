(function () {
  const config = window.APP_SUPABASE || {};
  const hasConfig = Boolean(config.url && config.anonKey);
  let supabase = null;

  function qs(id) { return document.getElementById(id); }
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function showMessage(text, type) {
    const box = qs('auth-message');
    if (!box) return;
    box.textContent = text;
    box.className = 'message show ' + (type || 'error');
  }

  function clearMessage() {
    const box = qs('auth-message');
    if (!box) return;
    box.textContent = '';
    box.className = 'message';
  }

  function formatDate(value) {
    if (!value) return '정보 없음';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ko-KR');
  }

  function setAuthUI(user) {
    const loginLink = qs('login-link');
    const logoutBtn = qs('logout-button');
    const emailNode = qs('auth-user-email');
    if (loginLink) loginLink.hidden = Boolean(user);
    if (logoutBtn) logoutBtn.hidden = !user;
    if (emailNode) {
      if (user && user.email) {
        emailNode.hidden = false;
        emailNode.textContent = user.email;
      } else {
        emailNode.hidden = true;
        emailNode.textContent = '';
      }
    }
  }

  async function requireAuth() {
    if (!document.body || document.body.dataset.requireAuth !== 'true') return;
    if (!supabase) return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const next = encodeURIComponent(location.pathname.split('/').pop() || 'mypage.html');
      location.replace('login.html?next=' + next);
      return;
    }
    fillMyPage(data.user);
  }

  function fillMyPage(user) {
    const email = qs('mypage-email');
    const uid = qs('mypage-user-id');
    const last = qs('mypage-last-signin');
    if (email) email.textContent = user.email || '정보 없음';
    if (uid) uid.textContent = user.id || '정보 없음';
    if (last) last.textContent = formatDate(user.last_sign_in_at);
  }

  async function refreshAuthUI() {
    if (!supabase) return;
    const [{ data: sessionRes }, { data: userRes }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser()
    ]);
    const user = userRes.user || (sessionRes.session && sessionRes.session.user) || null;
    setAuthUI(user);
    if (location.pathname.endsWith('login.html') && user) {
      const params = new URLSearchParams(location.search);
      const next = params.get('next') || 'mypage.html';
      if (next && next !== 'login.html') location.replace(next);
    }
    if (location.pathname.endsWith('mypage.html') && user) fillMyPage(user);
  }

  async function handleLogin(email, password) {
    clearMessage();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showMessage(error.message, 'error');
      return;
    }
    const params = new URLSearchParams(location.search);
    const next = params.get('next') || 'mypage.html';
    location.href = next;
  }

  async function handleSignup(email, password) {
    clearMessage();
    const redirectTo = location.origin + location.pathname.replace(/[^/]+$/, 'mypage.html');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) {
      showMessage(error.message, 'error');
      return;
    }
    if (data.user && !data.session) {
      showMessage('회원가입이 접수되었습니다. 이메일 인증 후 로그인해 주세요.', 'success');
      return;
    }
    showMessage('회원가입이 완료되었습니다. 마이페이지로 이동합니다.', 'success');
    setTimeout(() => { location.href = 'mypage.html'; }, 600);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    location.href = 'index.html';
  }

  function bindEvents() {
    const form = qs('auth-form');
    const signupBtn = qs('signup-button');
    const logoutBtn = qs('logout-button');
    const logoutBtn2 = qs('logout-button-secondary');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value.trim();
        const password = form.password.value;
        await handleLogin(email, password);
      });
    }
    if (signupBtn && form) {
      signupBtn.addEventListener('click', async () => {
        const email = form.email.value.trim();
        const password = form.password.value;
        await handleSignup(email, password);
      });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (logoutBtn2) logoutBtn2.addEventListener('click', handleLogout);
  }

  async function init() {
    if (!hasConfig) {
      showMessage('Supabase 설정이 비어 있습니다. supabase-config.js를 확인해 주세요.', 'error');
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      showMessage('Supabase 라이브러리를 불러오지 못했습니다.', 'error');
      return;
    }
    supabase = window.supabase.createClient(config.url, config.anonKey);
    bindEvents();
    await refreshAuthUI();
    await requireAuth();
    supabase.auth.onAuthStateChange(async () => {
      await refreshAuthUI();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

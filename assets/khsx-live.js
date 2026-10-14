
(() => {
  'use strict';

  let sb = null;
  let cfg = null;
  let currentProfile = null;
  let adminRendering = false;

  const $ = (s, r=document) => r.querySelector(s);
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(msg){ window.KHSX_APP?.toast ? window.KHSX_APP.toast(msg) : alert(msg); }

  async function api(name, body={}, method='POST'){
    const headers = {'Content-Type':'application/json'};
    if(sb){
      const {data:{session}} = await sb.auth.getSession();
      if(session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    }
    const res = await fetch(`/.netlify/functions/${name}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }


  function recoveryParams(){
    const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const query = new URLSearchParams(location.search || '');
    return {
      type: hash.get('type') || query.get('type') || '',
      accessToken: hash.get('access_token') || '',
      refreshToken: hash.get('refresh_token') || '',
      code: query.get('code') || ''
    };
  }

  function cleanRecoveryUrl(){
    try{
      history.replaceState({}, document.title, location.pathname);
    }catch(_){}
  }

  function renderRecoveryForm(message=''){
    const login = $('#login');
    const app = $('#app');
    if(app) app.style.display='none';
    if(login) login.style.display='grid';

    const card = $('.login-card');
    if(!card) return;

    card.innerHTML = `
      <div class="login-logo">⚓</div>
      <h1>Đặt mật khẩu mới</h1>
      <p>Cảng Nghệ Tĩnh • Kế hoạch sản xuất</p>
      ${message ? `<div class="demo-note">${esc(message)}</div>` : `
        <div class="demo-note">
          Liên kết khôi phục mật khẩu đã được xác thực.
          Hãy nhập mật khẩu mới cho tài khoản của bạn.
        </div>
      `}
      <form id="recoveryForm">
        <div class="field">
          <label>Mật khẩu mới</label>
          <input id="newPassword" type="password" minlength="8"
                 autocomplete="new-password" required
                 placeholder="Tối thiểu 8 ký tự" />
        </div>
        <div class="field">
          <label>Nhập lại mật khẩu</label>
          <input id="confirmPassword" type="password" minlength="8"
                 autocomplete="new-password" required
                 placeholder="Nhập lại mật khẩu mới" />
        </div>
        <button class="btn btn-primary btn-block" type="submit">
          Cập nhật mật khẩu
        </button>
        <button class="btn btn-secondary btn-block" type="button" id="backToLogin">
          Quay về đăng nhập
        </button>
      </form>
    `;

    $('#backToLogin')?.addEventListener('click', async () => {
      try{ await sb?.auth?.signOut(); }catch(_){}
      cleanRecoveryUrl();
      location.reload();
    });

    $('#recoveryForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const password = $('#newPassword')?.value || '';
      const confirm = $('#confirmPassword')?.value || '';
      const btn = e.currentTarget.querySelector('button[type="submit"]');

      if(password.length < 8){
        toast('Mật khẩu phải có ít nhất 8 ký tự.');
        return;
      }
      if(password !== confirm){
        toast('Hai lần nhập mật khẩu chưa khớp.');
        return;
      }

      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Đang cập nhật...';

      try{
        const { error } = await sb.auth.updateUser({ password });
        if(error) throw error;

        await sb.auth.signOut();
        cleanRecoveryUrl();

        card.innerHTML = `
          <div class="login-logo">✓</div>
          <h1>Đổi mật khẩu thành công</h1>
          <p>Cảng Nghệ Tĩnh • Kế hoạch sản xuất</p>
          <div class="demo-note">
            Mật khẩu mới đã được cập nhật. Anh/chị có thể đăng nhập lại ngay.
          </div>
          <button class="btn btn-primary btn-block" id="reloginBtn">
            Về trang đăng nhập
          </button>
        `;
        $('#reloginBtn')?.addEventListener('click', () => location.reload());
      }catch(err){
        console.error(err);
        toast(err?.message || 'Không cập nhật được mật khẩu.');
        btn.disabled = false;
        btn.textContent = old;
      }
    });
  }

  async function handleRecoveryFlow(){
    const p = recoveryParams();

    const looksLikeRecovery =
      p.type === 'recovery' ||
      (!!p.accessToken && !!p.refreshToken) ||
      !!p.code;

    if(!looksLikeRecovery) return false;

    try{
      if(p.accessToken && p.refreshToken){
        const { error } = await sb.auth.setSession({
          access_token: p.accessToken,
          refresh_token: p.refreshToken
        });
        if(error) throw error;
      }else if(p.code){
        const { error } = await sb.auth.exchangeCodeForSession(p.code);
        if(error) throw error;
      }else{
        const { data:{session}, error } = await sb.auth.getSession();
        if(error) throw error;
        if(!session) throw new Error('Liên kết khôi phục không còn phiên đăng nhập hợp lệ.');
      }

      const { data:{session}, error } = await sb.auth.getSession();
      if(error) throw error;
      if(!session) throw new Error('Liên kết khôi phục đã hết hạn hoặc không hợp lệ.');

      renderRecoveryForm();
      return true;
    }catch(err){
      console.error('Recovery error:', err);
      renderRecoveryForm(
        'Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. ' +
        'Hãy gửi một yêu cầu đặt lại mật khẩu mới từ Supabase.'
      );
      return true;
    }
  }

  async function init(){
    try{
      cfg = await fetch('/.netlify/functions/config').then(r => {
        if(!r.ok) throw new Error('Chưa cấu hình biến môi trường Netlify.');
        return r.json();
      });
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
        auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
      });
      window.khsxSupabase = sb;

      // Remove old demo form listeners by cloning form
      const oldForm = $('#loginForm');
      if(oldForm){
        const form = oldForm.cloneNode(true);
        oldForm.replaceWith(form);
        $('#loginPass', form).value='';
        form.addEventListener('submit', realLogin);
      }
      document.querySelectorAll('[data-demo-login]').forEach(x => x.closest('.demo-accounts')?.classList.add('hidden'));

      // Password recovery must be handled before normal auto-login.
      if(await handleRecoveryFlow()){
        observeAdmin();
        return;
      }

      const logoutOld = $('#logoutBtn');
      if(logoutOld){
        const b = logoutOld.cloneNode(true);
        logoutOld.replaceWith(b);
        b.onclick = async () => {
          await sb.auth.signOut();
          currentProfile=null;
          $('#app').style.display='none';
          $('#login').style.display='grid';
        };
      }

      const {data:{session}} = await sb.auth.getSession();
      if(session) await enterFromSession();

      observeAdmin();
    }catch(err){
      console.error(err);
      const note = $('.demo-note');
      if(note) {
        note.classList.remove('hidden');
        note.innerHTML = `<b>Chưa cấu hình Netlify:</b> ${esc(err.message)}<br>Hãy đặt 3 Environment Variables theo README.`;
      }
    }
  }

  async function realLogin(e){
    e.preventDefault();
    const username = $('#loginUser').value.trim();
    const password = $('#loginPass').value;
    const btn = e.currentTarget.querySelector('button[type=submit]');
    const old = btn.textContent;
    btn.disabled=true; btn.textContent='Đang đăng nhập...';
    try{
      const result = await api('auth-login', {username,password});
      const {error} = await sb.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token
      });
      if(error) throw error;
      await enterFromSession();
    }catch(err){
      toast(err.message || 'Đăng nhập thất bại');
    }finally{
      btn.disabled=false; btn.textContent=old;
    }
  }

  async function enterFromSession(){
    const {data:{user}, error:uerr} = await sb.auth.getUser();
    if(uerr || !user) throw uerr || new Error('Không lấy được phiên đăng nhập');

    const {data, error} = await sb.from('v_current_user_info').select('*').single();
    if(error) throw error;
    if(!data?.is_active) throw new Error('Tài khoản đã bị khóa.');
    currentProfile=data;

    const isAdmin = data.role === 'ADMIN' || data.permission_set_code === 'ADMIN';
    const externalUser = {
      username: data.username || 'user',
      code: data.employee_code || data.username || '',
      name: data.display_name || data.full_name || data.username || 'Người dùng',
      title: [data.unit_name, data.department_name, data.team_name].filter(Boolean).join(' • '),
      role: isAdmin ? 'ADMIN' : (data.employee_type || 'EMPLOYEE'),
      department: data.department_name || data.unit_name || '',
      permissionProfile: isAdmin ? 'admin' : 'personal_view',
      planAccess: [],
      employeeId: data.employee_id || null,
      realAuth: true
    };
    window.KHSX_APP.loginExternal(externalUser);

    const pill = $('.user-pill');
    if(pill){
      const b = pill.querySelector('b'), sm = pill.querySelector('small'), av=pill.querySelector('.avatar');
      if(b) b.textContent = externalUser.name;
      if(sm) sm.textContent = externalUser.title || data.permission_set_name || '';
      if(av) av.textContent = externalUser.name.slice(0,1).toUpperCase();
    }
    await updateNoticeBadge();
  }

  async function updateNoticeBadge(){
    try{
      const {data, error} = await sb.rpc('get_unread_notification_count');
      if(!error && $('#noticeBadge')) $('#noticeBadge').textContent = data || 0;
    }catch(_){}
  }

  function observeAdmin(){
    const admin = $('#admin');
    if(!admin) return;
    const obs = new MutationObserver(() => {
      if(adminRendering) return;
      if(admin.classList.contains('active') && currentProfile?.role === 'ADMIN' && admin.dataset.realAdmin !== '1'){
        renderRealAdmin();
      }
    });
    obs.observe(admin, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
    document.addEventListener('click', e => {
      const n=e.target.closest('[data-page="admin"], [data-go="admin"]');
      if(n) setTimeout(renderRealAdmin, 30);
    });
  }

  async function renderRealAdmin(){
    if(!currentProfile || currentProfile.role !== 'ADMIN') return;
    const host=$('#admin');
    if(!host || adminRendering) return;
    adminRendering=true;
    host.dataset.realAdmin='1';
    try{
      const [{data:accounts,error:aerr},{data:employees,error:eerr},{data:perms,error:perr}] = await Promise.all([
        sb.from('v_user_accounts').select('*').order('full_name'),
        sb.from('v_employees_without_account').select('*').order('full_name').limit(1000),
        sb.from('permission_sets').select('id,code,name,is_active').eq('is_active',true).order('name')
      ]);
      if(aerr) throw aerr; if(eerr) throw eerr; if(perr) throw perr;
      const normalPerms=(perms||[]).filter(p=>p.code!=='ADMIN');

      host.innerHTML=`
        <div class="page-head"><div><h1>Quản lý tài khoản</h1><p>Dữ liệu thật từ Supabase • ${employees?.length||0} nhân sự chưa có tài khoản.</p></div></div>
        <div class="admin-grid">
          <section class="panel">
            <div class="panel-head"><div><h2>＋ Tạo tài khoản</h2><p>Chọn nhân sự đã khai báo, không nhập lại họ tên/tổ.</p></div></div>
            <form id="realCreateUser" class="admin-form form-grid" style="padding:14px">
              <div class="field span2"><label>Nhân sự *</label>
                <select id="realEmployee" required>
                  <option value="">-- Chọn nhân sự --</option>
                  ${(employees||[]).map(x=>`<option value="${x.employee_id}">${esc(x.display_name||x.full_name)} — ${esc(x.employee_code||'')} — ${esc(x.team_name||x.department_name||x.unit_name||'')}</option>`).join('')}
                </select>
              </div>
              <div class="field"><label>Tên đăng nhập *</label><input id="realUsername" required autocomplete="off"></div>
              <div class="field"><label>Mật khẩu ban đầu *</label><input id="realPassword" type="password" minlength="6" required autocomplete="new-password"></div>
              <div class="field span2"><label>Bộ quyền *</label><select id="realPermission">${normalPerms.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
              <div class="form-actions span2"><button class="btn btn-primary">Tạo tài khoản</button></div>
            </form>
          </section>
          <section class="panel">
            <div class="panel-head"><div><h2>Tài khoản hệ thống</h2><p>${accounts?.length||0} tài khoản.</p></div></div>
            <div style="padding:0 14px 12px"><input id="realAccountSearch" class="account-search" placeholder="Tìm tài khoản, họ tên, tổ..."></div>
            <div class="account-table-wrap"><table class="account-table">
              <thead><tr><th>Tài khoản</th><th>Đơn vị / bộ phận</th><th>Quyền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody id="realAccountRows"></tbody>
            </table></div>
          </section>
        </div>`;

      const drawRows=()=>{
        const q=($('#realAccountSearch')?.value||'').trim().toLowerCase();
        const rows=(accounts||[]).filter(x=>`${x.username} ${x.full_name} ${x.display_name} ${x.unit_name} ${x.department_name} ${x.team_name}`.toLowerCase().includes(q));
        $('#realAccountRows').innerHTML=rows.map(x=>`
          <tr>
            <td><div class="account-user"><div class="avatar">${esc((x.display_name||x.full_name||x.username||'U').slice(0,1))}</div><div><b>${esc(x.display_name||x.full_name||x.username)}</b><small>${esc(x.username||'')}</small></div></div></td>
            <td><b>${esc(x.unit_name||'')}</b><br><small>${esc([x.department_name,x.team_name].filter(Boolean).join(' • '))}</small></td>
            <td>${esc(x.permission_set_name||x.role||'')}</td>
            <td>${x.is_active?'<span style="color:#79e0b4">● Hoạt động</span>':'<span style="color:#ff8994">● Đã khóa</span>'}</td>
            <td><div class="account-actions">
              ${x.role==='ADMIN'?'':`<button class="btn btn-secondary btn-small" data-reset="${x.user_id}">🔑 Mật khẩu</button><button class="btn ${x.is_active?'btn-danger':'btn-success'} btn-small" data-status="${x.user_id}" data-enabled="${x.is_active?'0':'1'}">${x.is_active?'Khóa':'Mở'}</button>`}
            </div></td>
          </tr>`).join('') || `<tr><td colspan="5" style="padding:26px;text-align:center">Không có dữ liệu.</td></tr>`;

        document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=async()=>{
          const password=prompt('Nhập mật khẩu mới (ít nhất 6 ký tự):');
          if(!password) return;
          try{ await api('reset-user-password',{user_id:b.dataset.reset,password}); toast('Đã đặt lại mật khẩu.'); }catch(e){toast(e.message);}
        });
        document.querySelectorAll('[data-status]').forEach(b=>b.onclick=async()=>{
          const enabled=b.dataset.enabled==='1';
          if(!confirm(`${enabled?'Mở':'Khóa'} tài khoản này?`)) return;
          try{ await api('set-user-status',{user_id:b.dataset.status,enabled}); toast(enabled?'Đã mở tài khoản.':'Đã khóa tài khoản.'); host.dataset.realAdmin='0'; await renderRealAdmin(); }catch(e){toast(e.message);}
        });
      };

      $('#realAccountSearch').oninput=drawRows;
      drawRows();

      $('#realCreateUser').onsubmit=async(e)=>{
        e.preventDefault();
        const btn=e.currentTarget.querySelector('button[type=submit]'); btn.disabled=true;
        try{
          await api('create-user',{
            employee_id:$('#realEmployee').value,
            username:$('#realUsername').value,
            password:$('#realPassword').value,
            permission_set_id:$('#realPermission').value
          });
          toast('Đã tạo tài khoản thành công.');
          host.dataset.realAdmin='0';
          await renderRealAdmin();
        }catch(err){toast(err.message);}
        finally{btn.disabled=false;}
      };
    }catch(err){
      host.innerHTML=`<div class="empty panel"><h3>Không tải được Quản lý tài khoản</h3><p>${esc(err.message)}</p></div>`;
    }finally{
      adminRendering=false;
    }
  }

  init();
})();

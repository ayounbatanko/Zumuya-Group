(() => {
  'use strict';
  const c = window.ZUMAYA_CONFIG || {};
  const $ = s => document.querySelector(s);
  if (!window.supabase || !c.SUPABASE_URL) return;
  const sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  let user = null;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function flash(msg, type = 'ok') {
    const el = $('#flash');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className = 'msg ' + (type === 'err' ? 'err' : 'ok');
  }

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.replace('compte.html'); return; }
    user = session.user;
    if (user.user_metadata?.account_type !== 'customer') {
      location.replace('compte.html');
      return;
    }

    const { data: p } = await sb.from('rg_customer_profiles').select('*').eq('user_id', user.id).maybeSingle();
    const f = $('#profileForm');
    if (f) {
      f.elements.full_name.value = p?.full_name || user.user_metadata?.name || '';
      f.elements.phone.value = p?.phone || user.user_metadata?.phone || '';
      f.elements.preferred_language.value = p?.preferred_language || 'fr';
    }

    await Promise.all([loadAddresses(), loadFavorites(), loadRecentOrders()]);
  }

  $('#profileForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const { error } = await sb.from('rg_customer_profiles').upsert({
      user_id: user.id,
      full_name: f.full_name,
      phone: (f.phone || '').trim() || null,
      preferred_language: f.preferred_language
    }, { onConflict: 'user_id' });
    flash(error ? error.message : 'Profil mis à jour.', error ? 'err' : 'ok');
  });

  async function loadAddresses() {
    const box = $('#addressList');
    if (!box) return;
    const { data, error } = await sb.from('rg_customer_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { flash(error.message, 'err'); return; }
    box.innerHTML = (data || []).map(a => `
      <article class="entry">
        <div>
          <b>${esc(a.label)}</b>
          ${a.is_default ? '<span class="badge">Par défaut</span>' : ''}
          <p class="muted" style="margin:4px 0 0">${esc([a.recipient_name, a.address_details, a.district, a.city].filter(Boolean).join(' · '))}</p>
          <p class="muted" style="margin:2px 0 0">${esc(a.phone || '')}</p>
        </div>
        <button type="button" class="btn secondary" data-del-address="${a.id}">Supprimer</button>
      </article>
    `).join('') || '<p class="muted">Aucune adresse enregistrée.</p>';
  }

  $('#addressForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    const isDefault = form.elements.is_default.checked;
    if (isDefault) {
      await sb.from('rg_customer_addresses').update({ is_default: false }).eq('user_id', user.id);
    }
    const { error } = await sb.from('rg_customer_addresses').insert({
      ...f,
      is_default: isDefault,
      user_id: user.id,
      country: 'Côte d’Ivoire'
    });
    if (error) { flash(error.message, 'err'); return; }
    form.reset();
    await loadAddresses();
    flash('Adresse enregistrée.');
  });

  $('#addressList')?.addEventListener('click', async e => {
    const b = e.target.closest('[data-del-address]');
    if (!b) return;
    const { error } = await sb.from('rg_customer_addresses')
      .delete()
      .eq('id', b.dataset.delAddress)
      .eq('user_id', user.id);
    flash(error ? error.message : 'Adresse supprimée.', error ? 'err' : 'ok');
    await loadAddresses();
  });

  async function loadFavorites() {
    const box = $('#favList');
    if (!box) return;
    const { data, error } = await sb.from('rg_customer_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { flash(error.message, 'err'); return; }
    box.innerHTML = (data || []).map(a => `
      <article class="entry">
        <div>${a.item_type === 'restaurant' ? 'Restaurant' : 'Produit'} · <code>${esc(a.item_id)}</code></div>
        <button type="button" class="btn secondary" data-del-fav="${a.id}">Retirer</button>
      </article>
    `).join('') || '<p class="muted">Aucun favori enregistré. Ajoutez-en depuis le catalogue.</p>';
  }

  $('#favList')?.addEventListener('click', async e => {
    const b = e.target.closest('[data-del-fav]');
    if (!b) return;
    await sb.from('rg_customer_favorites').delete().eq('id', b.dataset.delFav).eq('user_id', user.id);
    await loadFavorites();
  });

  async function loadRecentOrders() {
    const box = $('#ordersList');
    if (!box) return;
    try {
      const { data, error } = await sb.from('rg_orders')
        .select('id, status, created_at, total, restaurant_name')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!data || !data.length) {
        box.innerHTML = '<p class="muted">Aucune commande pour le moment.</p>';
        return;
      }
      box.innerHTML = data.map(o => `
        <article class="entry">
          <div>
            <b>${esc(o.restaurant_name || 'Commande')}</b>
            <span class="badge">${esc(o.status || '')}</span>
            <p class="muted" style="margin:4px 0 0">${new Date(o.created_at).toLocaleString('fr-FR')}</p>
          </div>
          <a class="btn secondary" href="resto-client.html">Voir</a>
        </article>
      `).join('');
    } catch (err) {
      box.innerHTML = '<p class="muted">Historique indisponible pour le moment.</p>';
    }
  }

  $('#logout')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.replace('compte.html');
  });

  boot();
})();

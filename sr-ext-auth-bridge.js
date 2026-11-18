/* Pont Supabase Auth (GoTrue) : inscription/connexion avec vrai hachage de mot de passe côté serveur.
   Identifiant = email ou téléphone transformé. À utiliser avec sql/v2_securite_rls.sql (étape 2). */
(function(){
  var X = window.RGX; if (!X) return;
  var A = X.auth = {};
  var CFG = (typeof window !== 'undefined' && window.ZUMAYA_CONFIG) ? window.ZUMAYA_CONFIG : {};
  var U = (CFG.SUPABASE_URL || window.RGX_SUPABASE_URL || 'https://azfunhfjmybekzakhtbu.supabase.co') + '/auth/v1';
  var K = CFG.SUPABASE_ANON_KEY || window.RGX_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZnVuaGZqbXliZWt6YWtodGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0Njg1MTYsImV4cCI6MjExMDA0NDUxNn0.Dz_8eSYVUfSqZQ3rA93FPclg1_zc8kdlyUxNkcDJ_0I';

  function mail(id) {
    var s = String(id || '').trim();
    if (s.indexOf('@') >= 0) return s.toLowerCase();
    return s.replace(/\D/g, '') + '@service-restauration.app';
  }
  function call(path, body) {
    return fetch(U + path, {
      method: 'POST',
      headers: { apikey: K, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }
  A.signUp = function (id, password, meta) {
    return call('/signup', { email: mail(id), password: password, data: meta || {} });
  };
  A.signIn = function (id, password) {
    return call('/token?grant_type=password', { email: mail(id), password: password }).then(function (j) {
      if (j.access_token) {
        try {
          localStorage.setItem('rgx_jwt', j.access_token);
          localStorage.setItem('rgx_refresh', j.refresh_token);
        } catch (e) {}
      }
      return j;
    });
  };
  A.token = function () {
    try { return localStorage.getItem('rgx_jwt'); } catch (e) { return null; }
  };
  A.signOut = function () {
    try {
      localStorage.removeItem('rgx_jwt');
      localStorage.removeItem('rgx_refresh');
    } catch (e) {}
  };
  A.reset = function (id) {
    return call('/recover', { email: mail(id) });
  };
})();

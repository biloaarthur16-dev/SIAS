// ---------------------------------------------------------------------------
// Couche "Interface" (client). Petit wrapper fetch autour de l'API REST.
// Expose l'objet global API utilise par app.js.
// ---------------------------------------------------------------------------
(function () {
  const BASE = "/api";
  const KEY = "sias_token";

  async function request(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(API.token ? { Authorization: `Bearer ${API.token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!res.ok) {
      const err = new Error((data && data.error) || `Erreur ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const API = {
    get token() {
      return localStorage.getItem(KEY);
    },
    setToken(t) {
      if (t) localStorage.setItem(KEY, t);
      else localStorage.removeItem(KEY);
    },
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    delete: (path) => request("DELETE", path),
  };

  window.API = API;
})();

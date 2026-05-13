const STORAGE_KEY = 'checky_deploy_id';
const META_PATH = '/build-meta.json';

/**
 * Après un nouveau déploiement, le navigateur peut encore servir un vieux index.html en cache.
 * Les en-têtes Vercel corrigent la cause ; ce module couvre le cas d’un onglet ouvert longtemps :
 * compare build-meta.json (no-store) au dernier id connu en localStorage.
 */
export function registerDeploymentUpdateCheck(): void {
  if (import.meta.env.DEV) return;

  let intervalId: ReturnType<typeof setInterval> | undefined;

  const check = async () => {
    try {
      const res = await fetch(`${META_PATH}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { id?: string };
      const id = typeof data.id === 'string' ? data.id : '';
      if (!id) return;

      const prev = localStorage.getItem(STORAGE_KEY);
      if (prev !== null && prev !== id) {
        const ok = window.confirm(
          'Une nouvelle version de Checky est disponible. Recharger la page pour l’utiliser ?'
        );
        if (ok) {
          localStorage.setItem(STORAGE_KEY, id);
          window.location.reload();
          return;
        }
        /* garde l’ancien id : on re-proposera au prochain passage / après l’intervalle */
      }
      if (prev === null) {
        localStorage.setItem(STORAGE_KEY, id);
      }
    } catch {
      /* réseau / hors-ligne */
    }
  };

  void check();
  intervalId = setInterval(check, 30 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });

  window.addEventListener('beforeunload', () => {
    if (intervalId !== undefined) clearInterval(intervalId);
  });
}

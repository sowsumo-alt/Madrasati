/**
 * Page restée ouverte pendant une mise en ligne : elle réclame l'ancien
 * fichier de style, qui n'existe plus, et s'affiche en texte brut (liens
 * bleus soulignés). Ce petit script, placé dans <head>, recharge alors la
 * page une fois — la nouvelle version arrive avec le bon style.
 *
 * Au plus un rechargement toutes les 30 secondes : si le style manque
 * vraiment (panne), la page ne tourne pas en boucle.
 */
export const STYLE_RELOAD_KEY = "madrasati:recharge-style";
export const STYLE_RELOAD_GUARD_MS = 30_000;

export const STYLESHEET_RECOVERY_SCRIPT = `(function () {
  var KEY = ${JSON.stringify(STYLE_RELOAD_KEY)};
  function reloadOnce() {
    try {
      var last = Number(sessionStorage.getItem(KEY)) || 0;
      if (Date.now() - last < ${STYLE_RELOAD_GUARD_MS}) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (e) {
      return;
    }
    location.reload();
  }
  function isStylesheet(el) {
    return el && el.tagName === "LINK" && /(^|\\s)stylesheet(\\s|$)/i.test(el.rel || "");
  }
  window.addEventListener("error", function (event) {
    if (isStylesheet(event.target)) reloadOnce();
  }, true);
  window.addEventListener("load", function () {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (!links[i].sheet) return reloadOnce();
    }
  });
})();`;

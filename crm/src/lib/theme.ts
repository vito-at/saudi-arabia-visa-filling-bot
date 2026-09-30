export type Theme = "light" | "dark";
export const THEME_COOKIE = "theme";

/**
 * Скрипт до отрисовки страницы: если тема ещё не выбрана (нет cookie), берём системную,
 * чтобы не было «вспышки» светлой темы.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(document.cookie.indexOf("${THEME_COOKIE}=")<0&&window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark")}}catch(e){}})();`;

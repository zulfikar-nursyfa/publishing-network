/** localStorage key for the display and accessibility settings (components/display-settings.jsx). */
export const DISPLAY_KEY = "pn-display";

/** Runs before the first paint (root layout) so saved settings never flash. */
export const DISPLAY_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${DISPLAY_KEY}")||"{}"),d=document.documentElement.dataset;for(var k in p)if(/^(text|motion|links|contrast)$/.test(k)&&/^[a-z]+$/.test(p[k]))d[k]=p[k]}catch(e){}`;

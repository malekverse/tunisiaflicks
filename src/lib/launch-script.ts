// The inline script (root layout, <head>) that decides, before the first paint, whether this page
// load is the start of an app: the Android TV app (its user agent), the Android phone app (its start
// address carries ?source=android-app), or the site installed from a browser (a standalone window).
// Then, once per app session, it shows the launch (AppLaunch, globals.css .tf-launch) and takes it
// away again. A website visit never sees it. Server-safe on purpose (a string for the layout).

const SHOW_MS = 1500
const REMOVE_MS = 2000

export const LAUNCH_SCRIPT = `(function(){try{var d=document.documentElement,m=function(q){return window.matchMedia&&matchMedia(q).matches};var app=navigator.userAgent.indexOf('TunisiaFlicksTV/')>-1||location.search.indexOf('source=android-app')>-1||m('(display-mode: standalone)')||m('(display-mode: fullscreen)')||navigator.standalone===true;if(!app||sessionStorage.getItem('tf-launched'))return;sessionStorage.setItem('tf-launched','1');d.classList.add('tf-launch');setTimeout(function(){d.classList.add('tf-launch-done')},${SHOW_MS});setTimeout(function(){d.classList.remove('tf-launch','tf-launch-done')},${REMOVE_MS})}catch(e){}})()`

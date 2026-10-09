// The inline script the root layout runs before anything else: the browser's one-time install offer
// ('beforeinstallprompt') is kept on window for useInstallPrompt (src/hooks/use-install-prompt.ts).
// Server-safe on purpose (a "use client" module can't hand a string to the layout).

export const INSTALL_PROMPT_EVENT = 'tf-install-prompt'

export const INSTALL_PROMPT_SCRIPT = `(function(){var w=window;w.addEventListener('beforeinstallprompt',function(e){e.preventDefault();w.__tfInstallPrompt=e;w.dispatchEvent(new Event('${INSTALL_PROMPT_EVENT}'))});w.addEventListener('appinstalled',function(){w.__tfInstallPrompt=null;w.__tfInstalled=true;w.dispatchEvent(new Event('${INSTALL_PROMPT_EVENT}'))})})()`

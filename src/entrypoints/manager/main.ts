import { mount } from 'svelte';
import { loadSettings } from '@/lib/stores/settings.svelte';
import '@/styles/base.css';
import App from './App.svelte';

// SAFETY: the element is declared in this entrypoint's own index.html, so it
// always exists by the time this module runs.
const target = document.getElementById('app') as HTMLElement;

// Settings are read BEFORE the first render, on purpose. The alternative --
// mount, then hydrate -- paints one frame in the browser's UI language and the
// system theme, then flips to the persisted ones. Awaiting means that frame
// holds an empty #app instead: a blank moment rather than a visible EN->VI or
// light->dark flip for exactly the users who bothered to change the setting.
//
// readSettings never throws (browser/storage.ts) and applyLocale guards the
// i18n lookup, so this cannot leave the page unmounted. No timeout race:
// storage.local.get always settles, and racing it would just re-introduce the
// wrong-locale render this exists to prevent.
await loadSettings();

export default mount(App, { target });

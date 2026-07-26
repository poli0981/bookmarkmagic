import { mount } from 'svelte';
import { loadLegal } from '@/lib/stores/legal.svelte';
import { loadSettings } from '@/lib/stores/settings.svelte';
import '@/styles/base.css';
import App from './App.svelte';

// SAFETY: the element is declared in this entrypoint's own index.html, so it
// always exists by the time this module runs.
const target = document.getElementById('app') as HTMLElement;

// Both reads happen BEFORE the first render, on purpose. The alternative --
// mount, then hydrate -- paints one frame in the browser's UI language and the
// system theme, then flips to the persisted ones, and flashes the legal gate at
// users who accepted it long ago. Awaiting means that frame holds an empty #app
// instead: a blank moment rather than visible EN->VI, light->dark or gate
// flicker.
//
// Neither loader can throw: readSettings and readLegal both swallow storage
// failures (browser/storage.ts) and applyLocale guards the i18n lookup. No
// timeout race either — storage.local.get always settles, and racing it would
// just re-introduce the wrong-locale render this exists to prevent.
await Promise.all([loadSettings(), loadLegal()]);

export default mount(App, { target });

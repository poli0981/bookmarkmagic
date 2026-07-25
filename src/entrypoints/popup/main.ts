import { mount } from 'svelte';
import { browser } from 'wxt/browser';
import { setLocale } from '@/lib/i18n/index.svelte';
import { resolveLocale } from '@/lib/i18n/resolve-locale';
import '@/styles/base.css';
import App from './App.svelte';

// Phase 0: browser UI language only. Phase 4 hydrates from the persisted
// Settings value first, falling back to this (docs/07 §2).
setLocale(resolveLocale(browser.i18n.getUILanguage()));

// SAFETY: the element is declared in this entrypoint's own index.html, so it
// always exists by the time this module runs.
const target = document.getElementById('app') as HTMLElement;

export default mount(App, { target });

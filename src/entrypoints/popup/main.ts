import { mount } from 'svelte';
import { loadSettings } from '@/lib/stores/settings.svelte';
import '@/styles/base.css';
import App from './App.svelte';

// SAFETY: the element is declared in this entrypoint's own index.html, so it
// always exists by the time this module runs.
const target = document.getElementById('app') as HTMLElement;

// Awaited before mount for the same reason as the Manager: the popup is small
// and fast, so a locale or theme flip here is proportionally more visible.
// The popup is never gated (docs/14 §2), so there is no legal read to make.
await loadSettings();

export default mount(App, { target });

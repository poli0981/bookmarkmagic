<script lang="ts">
  import { t } from '../i18n/index.svelte';
  import { LEGAL_URLS } from '../links';
  import { acceptLegal, type LegalStatus } from '../stores/legal.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';

  interface Props {
    status: Extract<LegalStatus, { kind: 'required' }>;
    /** Lets the shell move focus into the tab that mounts underneath. */
    onaccepted: () => void;
  }

  let { status, onaccepted }: Props = $props();

  /** How long to wait for `close()` before admitting it did nothing. */
  const CLOSE_GRACE_MS = 150;

  let checked = $state(false);
  let saving = $state(false);
  let saveFailed = $state(false);
  let saveDetail = $state<string | undefined>();
  let closeFailed = $state(false);
  let heading: HTMLHeadingElement | undefined = $state();
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  // Replacing <main>'s content without moving focus leaves a screen-reader user
  // reading the page they navigated away from (docs/06 §5).
  $effect(() => {
    heading?.focus();
    return () => {
      if (closeTimer !== undefined) clearTimeout(closeTimer);
    };
  });

  function accept(): void {
    if (!checked || saving) return;
    saving = true;
    saveFailed = false;
    saveDetail = undefined;
    // Timestamp taken at click time and passed down, so the store stays free of
    // ambient time. Nothing is dismissed until the write resolves.
    void acceptLegal(new Date().toISOString()).then((outcome) => {
      saving = false;
      if (outcome.ok) {
        onaccepted();
        return;
      }
      // The localized recovery sentence is the message; the raw browser error
      // is the separate technical detail (docs/02 §7). Showing `detail` in its
      // place made legal.saveFailed dead in all three locales — at the one
      // moment a first-run user most needs an actionable instruction.
      saveFailed = true;
      saveDetail = outcome.detail;
    });
  }

  /**
   * Decline is "close the tab" (docs/14 §2) — nothing is written either way.
   *
   * The Manager is opened by `tabs.create` or by Chrome's options mechanism, so
   * `window.opener` is null and close() is not guaranteed to work. Rather than
   * bet the decline path on it, wait a beat and tell the user plainly if the
   * document is still here. `tabs.remove` is not an option: it needs the `tabs`
   * permission, which docs/08 §2 forbids.
   */
  function closeTab(): void {
    // Clear first: repeated clicks would otherwise stack timers, and only the
    // last one would ever be cleaned up.
    if (closeTimer !== undefined) clearTimeout(closeTimer);
    globalThis.close();
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      closeFailed = true;
    }, CLOSE_GRACE_MS);
  }
</script>

<section class="gate" aria-labelledby="legal-gate-title">
  <header>
    <img src="/icon/48.png" alt="" width="48" height="48" />
    <h1 id="legal-gate-title" bind:this={heading} tabindex="-1">
      {status.reason === 'updated' ? t('legal.updatedTitle') : t('legal.title')}
    </h1>
  </header>

  {#if status.reason === 'updated'}
    <Callout tone="warn">{t('legal.updatedBody')}</Callout>
  {/if}

  <p class="summary">{t('legal.summary')}</p>

  <h2>{t('legal.documents')}</h2>
  <ul>
    {#each LEGAL_URLS as link (link.url)}
      <li>
        <a href={link.url} target="_blank" rel="noopener noreferrer">{t(link.labelKey)} ↗</a>
      </li>
    {/each}
  </ul>
  <p class="note">{t('legal.englishNote')}</p>

  <label class="accept">
    <input type="checkbox" bind:checked disabled={saving} />
    <span>{t('legal.accept')}</span>
  </label>

  {#if saveFailed}
    <Callout tone="danger">{t('legal.saveFailed')}</Callout>
    {#if saveDetail !== undefined}
      <pre class="detail">{saveDetail}</pre>
    {/if}
  {/if}

  <div class="actions">
    <Button variant="primary" disabled={!checked || saving} onclick={accept}>
      {t('legal.continue')}
    </Button>
    <Button disabled={saving} onclick={closeTab}>{t('legal.close')}</Button>
  </div>

  {#if closeFailed}
    <p class="note">{t('legal.closeManually')}</p>
  {/if}
</section>

<style>
  .gate {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    max-width: 56ch;
    margin: 0 auto;
    padding: var(--sp-5);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }

  h1 {
    margin: 0;
    font-size: var(--fs-4);
  }

  h2 {
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-2);
  }

  .summary {
    margin: 0;
    font-size: var(--fs-1);
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-4);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--fs-1);
  }

  .note {
    margin: 0;
    color: var(--fg-muted);
    font-size: var(--fs-0);
  }

  .accept {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-2);
    font-size: var(--fs-1);
  }

  .detail {
    margin: 0;
    padding: var(--sp-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--fg-muted);
    font-size: var(--fs-0);
    white-space: pre-wrap;
    overflow-x: auto;
  }

  .actions {
    display: flex;
    gap: var(--sp-2);
  }
</style>

<script lang="ts">
  /**
   * A failure, shown the way docs/02 §7 requires: a localized sentence, and the
   * raw browser string in a separate, copyable block.
   *
   * One component owns this because there is one specific way to get it wrong
   * and it has been got wrong three times. Writing `detail ?? t(key)` looks
   * like a sensible fallback, but the raw string is almost always present — so
   * the translation becomes dead code and a Vietnamese or Japanese user sees an
   * untranslated Chrome message as the entire explanation. LegalGate carries a
   * comment recording that exact defect; #edit and #export still had it.
   *
   * The detail is `user-select: all` so a reporter can grab it in one click for
   * an issue — it is the only part worth pasting.
   */
  import { t } from '../i18n/index.svelte';
  import Callout from './Callout.svelte';

  interface Props {
    /** Dotted i18n path. Never a resolved string. */
    messageKey: string;
    /** Raw, untranslated technical text. Omitted when there is none. */
    detail?: string | undefined;
    /**
     * An already-localized sentence adding what the failure left behind — how
     * many of a promised batch actually completed, for instance. Resolved by
     * the caller because it interpolates counts they hold.
     */
    note?: string | undefined;
  }

  let { messageKey, detail, note }: Props = $props();
</script>

<div class="error">
  <Callout tone="danger">{t(messageKey)}</Callout>
  {#if note !== undefined}
    <p class="note">{note}</p>
  {/if}
  {#if detail !== undefined}
    <pre>{detail}</pre>
  {/if}
</div>

<style>
  .error {
    margin-bottom: var(--sp-3);
  }

  .note {
    margin: var(--sp-2) 0 0;
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }

  pre {
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-0);
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-2);
    overflow: auto;
    user-select: all;
  }
</style>

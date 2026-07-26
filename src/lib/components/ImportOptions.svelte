<script lang="ts">
  import type { ImportMode } from '../browser/storage';
  import { num, t } from '../i18n/index.svelte';
  import Callout from './Callout.svelte';

  interface Props {
    mode: ImportMode;
    dedupe: boolean;
    duplicates: number;
    onchange: (patch: { mode?: ImportMode; dedupe?: boolean }) => void;
  }

  let { mode, dedupe, duplicates, onchange }: Props = $props();

  const MODES: ImportMode[] = ['new-folder', 'merge', 'replace'];
  const LABEL: Record<ImportMode, string> = {
    'new-folder': 'import.mode.newFolder',
    merge: 'import.mode.merge',
    replace: 'import.mode.replace',
  };
</script>

<fieldset>
  <legend>{t('import.mode.legend')}</legend>
  {#each MODES as value (value)}
    <label>
      <input
        type="radio"
        name="merge-mode"
        checked={mode === value}
        onchange={() => onchange({ mode: value })}
      />
      <span>{t(LABEL[value])}</span>
    </label>
  {/each}
</fieldset>

{#if mode === 'replace'}
  <Callout tone="danger">{t('import.replaceWarning')}</Callout>
{/if}

<label class="dedupe">
  <input
    type="checkbox"
    checked={mode === 'replace' ? false : dedupe}
    disabled={mode === 'replace'}
    onchange={(e) => onchange({ dedupe: (e.currentTarget as HTMLInputElement).checked })}
  />
  <span>{t('import.dedupe', { n: num(duplicates) })}</span>
</label>

{#if mode === 'replace'}
  <!-- Skipping "existing" links is meaningless once the tree is deleted, and
       actively harmful when restoring a backup — docs/05 §3. -->
  <p class="note">{t('import.dedupeDisabled')}</p>
{/if}

<style>
  fieldset {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--sp-3);
    margin: 0 0 var(--sp-3);
  }

  legend {
    font-size: var(--fs-0);
    color: var(--fg-muted);
    padding: 0 var(--sp-1);
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding-block: var(--sp-1);
  }

  .dedupe {
    margin-top: var(--sp-3);
  }

  .note {
    margin: var(--sp-1) 0 0 var(--sp-5);
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }
</style>

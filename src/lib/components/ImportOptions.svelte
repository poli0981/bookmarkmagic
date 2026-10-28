<script lang="ts">
  import type { ImportMode } from '../browser/storage';
  import { num, t } from '../i18n/index.svelte';
  import Callout from './Callout.svelte';
  import Icon, { type IconName } from './icons/Icon.svelte';

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
  const NOTE: Record<ImportMode, string> = {
    'new-folder': 'import.mode.newFolderNote',
    merge: 'import.mode.mergeNote',
    replace: 'import.mode.replaceNote',
  };
  const ICON: Record<ImportMode, IconName> = {
    'new-folder': 'folder-plus',
    merge: 'layers',
    replace: 'backup',
  };
</script>

<fieldset>
  <legend class="eyebrow">{t('import.mode.legend')}</legend>
  {#each MODES as value (value)}
    <label class="mode" class:selected={mode === value} class:danger={value === 'replace'}>
      <input
        type="radio"
        name="merge-mode"
        checked={mode === value}
        onchange={() => onchange({ mode: value })}
      />
      <span class="icon"><Icon name={ICON[value]} size={16} /></span>
      <span class="text">
        <span class="name">{t(LABEL[value])}</span>
        <span class="note">{t(NOTE[value])}</span>
      </span>
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
    onchange={(e) => onchange({ dedupe: e.currentTarget.checked })}
  />
  <span>{t('import.dedupe', { n: num(duplicates) })}</span>
</label>

{#if mode === 'replace'}
  <!-- Skipping "existing" links is meaningless once the tree is deleted, and
       actively harmful when restoring a backup — docs/05 §3. -->
  <p class="aside">{t('import.dedupeDisabled')}</p>
{/if}

<style>
  fieldset {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    border: none;
    padding: 0;
    margin: 0 0 var(--sp-3);
  }

  legend {
    padding: 0;
    margin-bottom: var(--sp-2);
  }

  .mode {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg);
    cursor: pointer;
  }

  .mode:hover {
    border-color: var(--accent);
  }

  .mode.selected {
    border-color: var(--accent);
    background: var(--accent-subtle);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .mode.danger.selected {
    border-color: var(--danger);
    box-shadow: inset 3px 0 0 var(--danger);
  }

  .mode input {
    margin-top: 3px;
  }

  .icon {
    display: inline-flex;
    padding-top: 1px;
    color: var(--accent);
  }

  .danger .icon {
    color: var(--danger);
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-size: var(--fs-1);
    font-weight: 600;
  }

  .note {
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }

  .dedupe {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
    font-size: var(--fs-1);
  }

  .aside {
    margin: var(--sp-1) 0 0 var(--sp-5);
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }
</style>

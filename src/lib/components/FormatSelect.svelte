<script lang="ts">
  import type { ExportFormat } from '../browser/storage';
  import { t } from '../i18n/index.svelte';
  import { FORMAT_META } from '../export/run-export';
  import Icon from './icons/Icon.svelte';

  interface Props {
    format: ExportFormat;
    onchange: (format: ExportFormat) => void;
  }

  let { format, onchange }: Props = $props();

  // SAFETY: FORMAT_META is a Record<ExportFormat, …>, so its keys are exactly that union.
  const FORMATS = Object.keys(FORMAT_META) as ExportFormat[];
</script>

<fieldset>
  <legend class="sr-only">{t('export.format')}</legend>
  {#each FORMATS as value (value)}
    <label class:selected={format === value}>
      <input
        type="radio"
        name="export-format"
        checked={format === value}
        onchange={() => onchange(value)}
      />
      <span class="icon"><Icon name={value === 'markdown' ? 'file' : value === 'bm-json' ? 'backup' : 'code'} size={16} /></span>
      <span class="body">
        <strong>{t(`export.formats.${value}.name`)} <span class="ext mono">.{FORMAT_META[value].extension}</span></strong>
        <span class="note">{t(`export.formats.${value}.note`)}</span>
      </span>
    </label>
  {/each}
</fieldset>

<style>
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  label {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--bg);
    cursor: pointer;
  }

  label:hover {
    border-color: var(--accent);
  }

  .selected {
    border-color: var(--accent);
    background: var(--accent-subtle);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  input {
    margin-top: 3px;
  }

  .icon {
    display: inline-flex;
    padding-top: 1px;
    color: var(--accent);
  }

  .body {
    display: flex;
    flex-direction: column;
    font-size: var(--fs-1);
  }

  .ext {
    font-weight: 400;
    color: var(--fg-muted);
  }

  .note {
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }
</style>

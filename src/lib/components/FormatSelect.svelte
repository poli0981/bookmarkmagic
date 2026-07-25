<script lang="ts">
  import type { ExportFormat } from '../browser/storage';
  import { t } from '../i18n/index.svelte';
  import { FORMAT_META } from '../export/run-export';

  interface Props {
    format: ExportFormat;
    onchange: (format: ExportFormat) => void;
  }

  let { format, onchange }: Props = $props();

  const FORMATS = Object.keys(FORMAT_META) as ExportFormat[];
</script>

<fieldset>
  <legend>{t('export.format')}</legend>
  {#each FORMATS as value (value)}
    <label class:selected={format === value}>
      <input
        type="radio"
        name="export-format"
        checked={format === value}
        onchange={() => onchange(value)}
      />
      <span class="body">
        <strong>{t(`export.formats.${value}.name`)}</strong>
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

  legend {
    font-size: var(--fs-0);
    color: var(--fg-muted);
    padding: 0 0 var(--sp-2);
  }

  label {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .selected {
    border-color: var(--accent);
    background: var(--bg-raised);
  }

  .body {
    display: flex;
    flex-direction: column;
  }

  .note {
    font-size: var(--fs-0);
    color: var(--fg-muted);
  }
</style>

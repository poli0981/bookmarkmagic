<script lang="ts">
  import { onMount } from 'svelte';
  import { getRootChildren, type LiveNode } from '../browser/bookmarks';
  import { BmBrowserError } from '../browser/errors';
  import type { ExportFormat } from '../browser/storage';
  import type { CsvDelimiter } from '../core/serialize/csv';
  import type { MarkdownStyle } from '../core/serialize/markdown';
  import { countSelected, FORMAT_META, runExport } from '../export/run-export';
  import { num, t } from '../i18n/index.svelte';
  import { getSettings } from '../stores/settings.svelte';
  import { pushToast } from '../stores/toast.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';
  import FolderPickTree from './FolderPickTree.svelte';
  import FormatSelect from './FormatSelect.svelte';

  let roots = $state<LiveNode[]>([]);
  let selection = $state<ReadonlySet<string> | undefined>(undefined);
  let format = $state<ExportFormat>('netscape-html');
  let loadError = $state<string | undefined>();
  let csvDelimiter = $state<CsvDelimiter>(',');
  let markdownStyle = $state<MarkdownStyle>('nested');

  onMount(() => {
    void load();
  });

  async function load(): Promise<void> {
    try {
      // runExport re-resolves the roots itself, so nothing is kept here.
      roots = await getRootChildren();
      const settings = getSettings();
      format = settings.defaultExportFormat;
      csvDelimiter = settings.csvDelimiter;
      markdownStyle = settings.markdownStyle;
    } catch (err) {
      loadError = err instanceof BmBrowserError ? err.detail : t('errors.UNKNOWN');
    }
  }

  /**
   * Live count for the button label. Deliberately NOT buildExport() — that
   * would re-serialize the entire tree on every render just to show a number,
   * and would print a filename timestamped differently from the saved file.
   */
  const bookmarkCount = $derived(countSelected(roots, selection));

  function download(): void {
    void (async () => {
      try {
        const result = await runExport({
          format,
          ...(selection !== undefined && { selection }),
          csvDelimiter,
          markdownStyle,
          now: new Date(),
        });
        pushToast(t('export.saved', { name: result.filename }), 'success');
      } catch (err) {
        // Tone matters: this used to share a variable with the success message
        // and rendered failures in success-green.
        pushToast(err instanceof BmBrowserError ? err.detail : t('errors.UNKNOWN'), 'danger');
      }
    })();
  }
</script>

{#if loadError !== undefined}
  <Callout tone="danger">{loadError}</Callout>
{:else}
  <div class="split">
    <section aria-label={t('export.scope')}>
      <FolderPickTree {roots} {selection} onchange={(next) => (selection = next)} />
    </section>

    <section class="side">
      <FormatSelect {format} onchange={(next) => (format = next)} />

      {#if !FORMAT_META[format].importable}
        <Callout tone="warn">{t('export.markdownNote')}</Callout>
      {/if}
      {#if format === 'csv'}
        <Callout tone="warn">{t('export.csvNote')}</Callout>
        <label class="option">
          <span>{t('export.csvDelimiter')}</span>
          <select
            value={csvDelimiter}
            onchange={(e) => (csvDelimiter = (e.currentTarget as HTMLSelectElement).value as CsvDelimiter)}
          >
            <option value=",">{t('export.comma')}</option>
            <option value=";">{t('export.semicolon')}</option>
          </select>
        </label>
      {/if}

      {#if format === 'markdown'}
        <label class="option">
          <span>{t('export.markdownStyle')}</span>
          <select
            value={markdownStyle}
            onchange={(e) => (markdownStyle = (e.currentTarget as HTMLSelectElement).value as MarkdownStyle)}
          >
            <option value="nested">{t('export.nested')}</option>
            <option value="flat">{t('export.flat')}</option>
          </select>
        </label>
      {/if}

      <Button
        variant="primary"
        disabled={bookmarkCount === 0}
        onclick={download}
      >
        {t('export.start', { n: num(bookmarkCount) })}
      </Button>

    </section>
  </div>
{/if}

<style>
  .split {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--sp-5);
    align-items: start;
  }

  @media (max-width: 780px) {
    .split {
      grid-template-columns: 1fr;
    }
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    font-size: var(--fs-1);
  }

  .option select {
    font: inherit;
    padding: var(--sp-1) var(--sp-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--fg);
  }
</style>

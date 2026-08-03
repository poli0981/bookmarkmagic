<script lang="ts">
  import { onMount } from 'svelte';
  import { getRootChildren, type LiveNode } from '../browser/bookmarks';
  import { type DescribedError, describeError } from '../browser/describe-error';
  import type { ExportFormat } from '../browser/storage';
  import type { CsvDelimiter } from '../core/serialize/csv';
  import type { MarkdownStyle } from '../core/serialize/markdown';
  import { countSelected, FORMAT_META, runExport } from '../export/run-export';
  import { num, t } from '../i18n/index.svelte';
  import {
    CSV_DELIMITER_CHOICES,
    MARKDOWN_STYLE_CHOICES,
    parseChoice,
  } from '../settings/options';
  import { getSettings } from '../stores/settings.svelte';
  import { pushToast } from '../stores/toast.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';
  import ErrorCallout from './ErrorCallout.svelte';
  import FolderPickTree from './FolderPickTree.svelte';
  import FormatSelect from './FormatSelect.svelte';

  let roots = $state<LiveNode[]>([]);
  let selection = $state<ReadonlySet<string> | undefined>(undefined);
  let format = $state<ExportFormat>('netscape-html');
  let loadError = $state<DescribedError | undefined>();
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
      // Was `err.detail` alone — a raw English Chrome string as the entire
      // screen, in all three languages (docs/02 §7).
      loadError = describeError(err);
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
        // and rendered failures in success-green. The message is the localized
        // sentence — a toast has no room for a detail block, which is the same
        // reasoning the header's save-failure toast records.
        pushToast(t(describeError(err).messageKey), 'danger');
      }
    })();
  }
</script>

{#if loadError !== undefined}
  <ErrorCallout messageKey={loadError.messageKey} detail={loadError.detail} />
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
            onchange={(e) => {
              const next = parseChoice(e.currentTarget.value, CSV_DELIMITER_CHOICES);
              if (next !== undefined) csvDelimiter = next;
            }}
          >
            {#each CSV_DELIMITER_CHOICES as choice (choice.value)}
              <option value={choice.value}>{t(choice.labelKey)}</option>
            {/each}
          </select>
        </label>
      {/if}

      {#if format === 'markdown'}
        <label class="option">
          <span>{t('export.markdownStyle')}</span>
          <select
            value={markdownStyle}
            onchange={(e) => {
              const next = parseChoice(e.currentTarget.value, MARKDOWN_STYLE_CHOICES);
              if (next !== undefined) markdownStyle = next;
            }}
          >
            {#each MARKDOWN_STYLE_CHOICES as choice (choice.value)}
              <option value={choice.value}>{t(choice.labelKey)}</option>
            {/each}
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

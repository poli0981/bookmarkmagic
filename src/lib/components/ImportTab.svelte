<script lang="ts">
  import { describeError } from '../browser/describe-error';
  import { backupFilename as suggestBackupName } from '../browser/download';
  import { BmAborted } from '../browser/errors';
  import { num, t, tPlural } from '../i18n/index.svelte';
  import { prepareImport, previewPlan, runImport } from '../import/run-import';
  import {
    answerAttestation,
    awaitAttestation,
    beginWrite,
    cancelWrite,
    getImportOptions,
    getImportState,
    getPrepared,
    resetImport,
    setImportOptions,
    setImportState,
    setPrepared,
    type WriteSite,
  } from '../stores/import-session.svelte';
  import { navigate } from '../stores/route.svelte';
  import { getSettings } from '../stores/settings.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import DropZone from './DropZone.svelte';
  import ErrorCallout from './ErrorCallout.svelte';
  import ImportOptions from './ImportOptions.svelte';
  import ImportReport from './ImportReport.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import StatsCard from './StatsCard.svelte';
  import TreePreview from './TreePreview.svelte';
  import WarningList from './WarningList.svelte';

  // `prepared` lives in the session store, not here: the Manager unmounts this
  // component on every route change (docs/03 §5).
  const prepared = $derived(getPrepared());
  const session = $derived(getImportState());
  const options = $derived(getImportOptions());
  /** The counts the Start button and the Replace confirmation promise (uM10). */
  const forecast = $derived(
    prepared === undefined ? undefined : previewPlan(prepared, options.mode, options.dedupe),
  );
  let confirmingReplace = $state(false);

  const counts = (bookmarks: number, folders: number): string =>
    t('import.countPair', {
      bookmarks: tPlural('import.countBookmarks', bookmarks),
      folders: tPlural('import.countFolders', folders),
    });

  async function onFile(file: File): Promise<void> {
    setImportState({ kind: 'validating', filename: file.name });
    try {
      const result = await prepareImport(file, {
        rootTitles: {
          toolbar: t('import.rootTitle.toolbar'),
          other: t('import.rootTitle.unfiled'),
          mobile: t('import.rootTitle.mobile'),
        },
      });
      setPrepared(result);
      setImportOptions({ mode: getSettings().defaultMergeMode });
      setImportState({
        kind: 'parsed',
        filename: file.name,
        result: result.result,
        duplicates: result.duplicates,
      });
    } catch (err) {
      setPrepared(undefined);
      setImportState({ kind: 'error', filename: file.name, ...describeError(err) });
    }
  }

  /** Replace asks first, with exact numbers (docs/09 T4); the other modes start at once. */
  function onStart(filename: string): void {
    if (options.mode === 'replace') confirmingReplace = true;
    else void start(filename);
  }

  async function start(filename: string): Promise<void> {
    confirmingReplace = false;
    const current = prepared;
    if (current === undefined) return;
    const signal = beginWrite();
    const now = new Date();
    const backupFilename = suggestBackupName(now);
    const folder = t('import.folderName', { date: formatFolderDate(now) });
    const where: WriteSite = { mode: options.mode, folder: options.mode === 'new-folder' ? folder : '' };
    /** The name the backup was saved under, once it is on disk. Nothing may point at it before. */
    let savedAs: string | undefined;

    // runImport opens the save picker as its first statement, so the transient
    // activation from this click (or the confirmation's) still holds.
    setImportState(
      options.mode === 'replace'
        ? { kind: 'backing-up', filename }
        : { kind: 'writing', filename, progress: { done: 0, total: 0, currentPath: '' } },
    );

    try {
      const outcome = await runImport({
        prepared: current,
        mode: options.mode,
        dedupe: options.dedupe,
        newFolderTitle: folder,
        backupFilename,
        backupDescription: t('import.backupFileType'),
        now,
        signal,
        onProgress: (progress) => {
          setImportState({ kind: 'writing', filename, progress });
        },
        // The ONLY signal that the backup exists. No Cancel is offered while the
        // tree is being deleted: it used to stay live and report "0 created".
        onClearing: (name) => {
          savedAs = name;
          setImportState({ kind: 'clearing', filename });
        },
        confirmUnprovenBackup: () => {
          setImportState({ kind: 'attesting', filename, backupFilename });
          return awaitAttestation();
        },
      });
      setImportState({ kind: 'done', filename, created: outcome.created, plan: outcome.plan });
    } catch (err) {
      // A backup filename appears only when the backup really exists — never
      // for a failure before it, which would send a frightened user looking
      // for a file that was never written.
      const backup = savedAs === undefined ? {} : { backupFilename: savedAs };
      if (err instanceof BmAborted) {
        setImportState({ kind: 'cancelled', filename, created: err.done, where, ...backup });
        return;
      }
      setImportState({ kind: 'error', filename, ...describeError(err), where, ...backup });
    }
  }

  /**
   * ISO date + local time (docs/07 §3), deliberately not Intl: it names a
   * folder this extension creates in the user's browser.
   */
  function formatFolderDate(now: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
</script>

{#if session.kind === 'idle'}
  <section class="panel">
    <h2 class="eyebrow">01 · {t('import.stepSource')}</h2>
    <DropZone onfile={(file) => void onFile(file)} />
  </section>
{:else if session.kind === 'validating'}
  <section class="panel">
    <h2 class="eyebrow">01 · {t('import.stepSource')}</h2>
    <p class="muted mono">{t('import.reading', { name: session.filename })}</p>
  </section>
{:else if session.kind === 'parsed'}
  <div class="split">
    <section class="panel">
      <h2 class="eyebrow">
        02 · {t('import.preview')}
        <span class="file mono">{session.filename}</span>
        {#if prepared !== undefined}<span class="format mono">{t(`import.format.${prepared.format}`)}</span>{/if}
      </h2>
      <TreePreview
        roots={session.result.roots}
        status={prepared?.status ?? new WeakMap()}
        label={t('import.preview')}
      />
    </section>
    <section class="panel side">
      <h2 class="eyebrow">03 · {t('import.stepOptions')}</h2>
      <StatsCard stats={session.result.stats} duplicates={session.duplicates} />
      <WarningList warnings={session.result.warnings} />
      <ImportOptions
        mode={options.mode}
        dedupe={options.dedupe}
        duplicates={session.duplicates}
        onchange={(patch) => setImportOptions(patch)}
      />
      <p class="muted">{t('import.dateNotice')}</p>
      <Button
        variant={options.mode === 'replace' ? 'danger' : 'primary'}
        icon="upload"
        iconMotion="bob"
        onclick={() => onStart(session.filename)}
      >
        {tPlural('import.start', forecast?.stats.bookmarkCount ?? session.result.stats.bookmarks)}
      </Button>
    </section>
  </div>
  <ConfirmDialog
    open={confirmingReplace}
    danger
    title={t('import.replaceConfirmTitle')}
    body={t('import.replaceConfirmBody', {
      current: counts(prepared?.current.bookmarks ?? 0, prepared?.current.folders ?? 0),
      incoming: counts(forecast?.stats.bookmarkCount ?? 0, forecast?.stats.folderCount ?? 0),
      name: session.filename,
    })}
    confirmLabel={t('import.replaceConfirm')}
    cancelLabel={t('common.cancel')}
    onconfirm={() => void start(session.filename)}
    oncancel={() => (confirmingReplace = false)}
  />
{:else if session.kind === 'backing-up'}
  <Callout tone="warn">{t('import.backingUp')}</Callout>
{:else if session.kind === 'attesting'}
  <!-- The anchor download reports nothing, so this confirmation is the only
       thing standing between the user and an unbacked-up deletion. -->
  <Callout tone="danger">{t('import.attest', { name: session.backupFilename })}</Callout>
  <div class="actions">
    <Button variant="danger" onclick={() => answerAttestation(true)}>{t('import.attestConfirm')}</Button>
    <Button onclick={() => answerAttestation(false)}>{t('common.cancel')}</Button>
  </div>
{:else if session.kind === 'clearing'}
  <Callout tone="danger">{t('import.clearing')}</Callout>
{:else if session.kind === 'writing'}
  <section class="panel writing">
    <h2 class="eyebrow">04 · {t('import.stepWriting')}</h2>
    <ProgressBar done={session.progress.done} total={session.progress.total} label={t('common.import')} />
    <p class="muted mono">
      {t('import.progress', { done: num(session.progress.done), total: num(session.progress.total) })}
      {#if session.progress.currentPath !== ''}<span class="path">{session.progress.currentPath}</span>{/if}
    </p>
    <Callout tone="warn">{t('import.keepTabOpen')}</Callout>
    <div class="actions"><Button icon="close" onclick={cancelWrite}>{t('common.cancel')}</Button></div>
  </section>
{:else if session.kind === 'error'}
  <ErrorCallout messageKey={session.messageKey} detail={session.detail} />
  <ImportReport state={session} />
  <div class="actions"><Button onclick={resetImport}>{t('import.another')}</Button></div>
{:else}
  <ImportReport state={session} />
  <div class="actions">
    {#if session.kind === 'done'}
      <Button variant="primary" icon="edit" onclick={() => navigate('edit')}>{t('import.openEdit')}</Button>
    {/if}
    <Button onclick={resetImport}>{t('import.another')}</Button>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }

  h2 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    margin: 0;
  }

  .file,
  .format {
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    padding: 0 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-sunken);
    max-width: 32ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .format {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-subtle);
  }

  .split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--width-side);
    gap: var(--sp-5);
    align-items: start;
  }

  @media (max-width: 820px) {
    .split {
      grid-template-columns: 1fr;
    }
  }

  .muted {
    color: var(--fg-muted);
    font-size: var(--fs-1);
    margin: 0;
  }

  .path {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
</style>

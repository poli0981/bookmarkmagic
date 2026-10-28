<script lang="ts">
  /**
   * Step 04 of an import — docs/03 §1 steps 6–8: the safety backup, its
   * attestation, the Replace clear, and the write itself. No Cancel while the
   * tree is being cleared: it used to stay live there and report "0 created".
   */
  import { num, t } from '../i18n/index.svelte';
  import {
    answerAttestation,
    cancelWrite,
    type ImportState,
  } from '../stores/import-session.svelte';
  import Button from './Button.svelte';
  import Callout from './Callout.svelte';
  import { focusWhenShown } from './focus-heading';
  import ProgressBar from './ProgressBar.svelte';

  type Writing = Extract<ImportState, { kind: 'backing-up' | 'attesting' | 'clearing' | 'writing' }>;

  interface Props {
    state: Writing;
  }

  let { state }: Props = $props();
</script>

<section class="panel">
  <h2 class="eyebrow" tabindex="-1" {@attach focusWhenShown}>04 · {t('import.stepWriting')}</h2>
  {#if state.kind === 'backing-up'}
    <Callout tone="warn">{t('import.backingUp')}</Callout>
  {:else if state.kind === 'attesting'}
    <!-- The anchor download reports nothing, so this confirmation is the only
         thing standing between the user and an unbacked-up deletion. -->
    <Callout tone="danger">{t('import.attest', { name: state.backupFilename })}</Callout>
    <div class="actions">
      <Button variant="danger" onclick={() => answerAttestation(true)}>{t('import.attestConfirm')}</Button>
      <Button onclick={() => answerAttestation(false)}>{t('common.cancel')}</Button>
    </div>
  {:else if state.kind === 'clearing'}
    <Callout tone="danger">{t('import.clearing')}</Callout>
  {:else}
    <ProgressBar done={state.progress.done} total={state.progress.total} label={t('common.import')} />
    <p class="muted mono">
      {t('import.progress', { done: num(state.progress.done), total: num(state.progress.total) })}
      {#if state.progress.currentPath !== ''}<span class="path">{state.progress.currentPath}</span>{/if}
    </p>
    <Callout tone="warn">{t('import.keepTabOpen')}</Callout>
    <div class="actions"><Button icon="close" onclick={cancelWrite}>{t('common.cancel')}</Button></div>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }

  h2 {
    margin: 0;
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
  }
</style>

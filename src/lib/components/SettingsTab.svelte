<script lang="ts">
  import type { Settings } from '../browser/storage';
  import { t } from '../i18n/index.svelte';
  import {
    CSV_DELIMITER_CHOICES,
    EXPORT_FORMAT_CHOICES,
    IMPORT_MODE_CHOICES,
    MARKDOWN_STYLE_CHOICES,
    parseChoice,
    type SettingChoice,
  } from '../settings/options';
  import { getSettings, resetSettings, updateSettings } from '../stores/settings.svelte';
  import { pushToast } from '../stores/toast.svelte';
  import Button from './Button.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
  import SettingRow from './SettingRow.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  const settings = $derived(getSettings());
  let confirmingReset = $state(false);
  /** Raw browser error behind the last failed save, if any. */
  let saveDetail = $state<string | undefined>();

  /**
   * Every write reports what actually happened. The toast used to be the only
   * feedback and fired before the write settled, which meant a failed save
   * still said "Saved".
   */
  function save(patch: Partial<Settings>, successKey = 'settings.saved'): void {
    void updateSettings(patch).then((outcome) => {
      if (outcome.ok) {
        pushToast(t(successKey), 'success');
        saveDetail = undefined;
        return;
      }
      // The LOCALIZED sentence is the message; the raw browser error is the
      // separate technical detail docs/02 §7 asks for. Putting `detail` first
      // made every translation of settings.saveFailed dead code and showed a
      // VI/JA user an untranslated Chrome string.
      pushToast(t('settings.saveFailed'), 'danger');
      saveDetail = outcome.detail;
    });
  }

  /** Narrow a `<select>` value, then save — bailing before the patch is built. */
  function saveChoice<K extends keyof Settings & string>(
    key: K,
    raw: string,
    choices: readonly SettingChoice<Settings[K] & string>[],
  ): void {
    const next = parseChoice(raw, choices);
    if (next === undefined) return;
    // SAFETY: `next` came out of a table typed against Settings[K], so this
    // narrowing only re-states what parseChoice already proved.
    save({ [key]: next } as Partial<Settings>);
  }

  function confirmReset(): void {
    confirmingReset = false;
    void resetSettings().then((outcome) => {
      if (outcome.ok) {
        pushToast(t('settings.resetDone'), 'success');
        saveDetail = undefined;
        return;
      }
      pushToast(t('settings.saveFailed'), 'danger');
      saveDetail = outcome.detail;
    });
  }
</script>

<section aria-label={t('common.settings')}>
  <p class="muted">{t('settings.autosave')}</p>

  <SettingRow label={t('settings.language')} description={t('settings.languageNote')}>
    {#snippet control()}
      <LanguageSwitcher
        compact
        value={settings.locale}
        onchange={(locale) => save({ locale })}
      />
    {/snippet}
  </SettingRow>

  <SettingRow label={t('settings.theme')}>
    {#snippet control()}
      <ThemeToggle value={settings.theme} onchange={(theme) => save({ theme })} />
    {/snippet}
  </SettingRow>

  <SettingRow
    label={t('settings.defaultExportFormat')}
    description={t('settings.defaultExportFormatNote')}
  >
    {#snippet control()}
      <select
        aria-label={t('settings.defaultExportFormat')}
        value={settings.defaultExportFormat}
        onchange={(event) =>
          saveChoice('defaultExportFormat', event.currentTarget.value, EXPORT_FORMAT_CHOICES)}
      >
        {#each EXPORT_FORMAT_CHOICES as choice (choice.value)}
          <option value={choice.value}>{t(choice.labelKey)}</option>
        {/each}
      </select>
    {/snippet}
  </SettingRow>

  <SettingRow
    label={t('settings.defaultImportMode')}
    description={t('settings.defaultImportModeNote')}
  >
    {#snippet control()}
      <select
        aria-label={t('settings.defaultImportMode')}
        value={settings.defaultMergeMode}
        onchange={(event) =>
          saveChoice('defaultMergeMode', event.currentTarget.value, IMPORT_MODE_CHOICES)}
      >
        {#each IMPORT_MODE_CHOICES as choice (choice.value)}
          <option value={choice.value}>{t(choice.labelKey)}</option>
        {/each}
      </select>
    {/snippet}
  </SettingRow>

  <SettingRow label={t('settings.csvDelimiter')} description={t('settings.csvDelimiterNote')}>
    {#snippet control()}
      <select
        aria-label={t('settings.csvDelimiter')}
        value={settings.csvDelimiter}
        onchange={(event) =>
          saveChoice('csvDelimiter', event.currentTarget.value, CSV_DELIMITER_CHOICES)}
      >
        {#each CSV_DELIMITER_CHOICES as choice (choice.value)}
          <option value={choice.value}>{t(choice.labelKey)}</option>
        {/each}
      </select>
    {/snippet}
  </SettingRow>

  <SettingRow label={t('settings.markdownStyle')} description={t('settings.markdownStyleNote')}>
    {#snippet control()}
      <select
        aria-label={t('settings.markdownStyle')}
        value={settings.markdownStyle}
        onchange={(event) =>
          saveChoice('markdownStyle', event.currentTarget.value, MARKDOWN_STYLE_CHOICES)}
      >
        {#each MARKDOWN_STYLE_CHOICES as choice (choice.value)}
          <option value={choice.value}>{t(choice.labelKey)}</option>
        {/each}
      </select>
    {/snippet}
  </SettingRow>

  {#if saveDetail !== undefined}
    <pre class="detail">{saveDetail}</pre>
  {/if}

  <footer>
    <Button onclick={() => (confirmingReset = true)}>{t('settings.reset')}</Button>
  </footer>
</section>

<ConfirmDialog
  open={confirmingReset}
  title={t('settings.resetTitle')}
  body={t('settings.resetBody')}
  confirmLabel={t('settings.resetConfirm')}
  cancelLabel={t('common.cancel')}
  onconfirm={confirmReset}
  oncancel={() => (confirmingReset = false)}
/>

<style>
  section {
    max-width: 640px;
  }

  .muted {
    margin: 0 0 var(--sp-3);
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }

  select {
    font: inherit;
    padding: var(--sp-1) var(--sp-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--fg);
  }

  select:hover {
    border-color: var(--accent);
  }

  .detail {
    margin: var(--sp-3) 0 0;
    padding: var(--sp-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-raised);
    color: var(--fg-muted);
    font-size: var(--fs-0);
    white-space: pre-wrap;
    overflow-x: auto;
  }

  footer {
    padding-top: var(--sp-4);
  }
</style>

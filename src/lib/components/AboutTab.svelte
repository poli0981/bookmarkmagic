<script lang="ts">
  import { getAppVersion } from '../browser/app-info';
  import { t } from '../i18n/index.svelte';
  import { CHANGELOG_URL, DONATE_LINKS, ISSUES_URL, LEGAL_URLS, REPO_URL } from '../links';

  const version = getAppVersion();
</script>

<section aria-label={t('common.about')}>
  <header>
    <img src="/icon/48.png" alt="" width="48" height="48" />
    <div>
      <strong>{t('common.appName')}</strong>
      {#if version !== ''}<span class="version">{t('about.version', { version })}</span>{/if}
    </div>
  </header>

  <p class="tagline">{t('about.tagline')}</p>

  <h2>{t('about.links')}</h2>
  <ul class="links">
    <li><a href={REPO_URL} target="_blank" rel="noopener noreferrer">{t('about.repo')} ↗</a></li>
    <li><a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">{t('about.issues')} ↗</a></li>
    <li>
      <a href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer">
        {t('about.changelog')} ↗
      </a>
    </li>
  </ul>

  <h2>{t('about.thirdParty')}</h2>
  <p class="muted">{t('about.thirdPartyNote')}</p>

  <h2>{t('about.donate')}</h2>
  <p class="muted">{t('about.donateNote')}</p>
  <ul class="links">
    {#each DONATE_LINKS as link (link.url)}
      <li><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a></li>
    {/each}
  </ul>

  <h2>{t('about.legal')}</h2>
  <ul class="links">
    {#each LEGAL_URLS as link (link.url)}
      <li>
        <a href={link.url} target="_blank" rel="noopener noreferrer">{t(link.labelKey)} ↗</a>
      </li>
    {/each}
  </ul>
  <p class="muted">{t('legal.englishNote')}</p>
</section>

<style>
  section {
    max-width: 640px;
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding-bottom: var(--sp-3);
    border-bottom: 1px solid var(--border);
  }

  header div {
    display: flex;
    flex-direction: column;
  }

  header strong {
    font-size: var(--fs-3);
  }

  .version {
    font-size: var(--fs-0);
    color: var(--fg-muted);
    font-variant-numeric: tabular-nums;
  }

  .tagline {
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }

  h2 {
    margin: var(--sp-5) 0 var(--sp-2);
    font-size: var(--fs-2);
  }

  .muted {
    margin: 0;
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2) var(--sp-4);
    margin: var(--sp-2) 0 0;
    padding: 0;
    list-style: none;
    font-size: var(--fs-1);
  }
</style>

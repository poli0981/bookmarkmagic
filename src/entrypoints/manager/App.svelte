<script lang="ts">
  import { t } from '@/lib/i18n/index.svelte';
</script>

<main>
  <h1>{t('common.appName')}</h1>
  <p>hello — manager</p>
</main>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--sp-6) var(--sp-4);
  }

  h1 {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-4);
    color: var(--accent);
  }

  p {
    margin: 0;
    color: var(--fg-muted);
  }
</style>

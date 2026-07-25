<script lang="ts">
  import { t } from '@/lib/i18n/index.svelte';
</script>

<main>
  <h1>{t('common.appName')}</h1>
  <p>hello — popup</p>
</main>

<style>
  main {
    width: 320px;
    padding: var(--sp-4);
  }

  h1 {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-3);
    color: var(--accent);
  }

  p {
    margin: 0;
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }
</style>

<script lang="ts">
  import Button from './Button.svelte';
  import Modal from './Modal.svelte';

  interface Props {
    open: boolean;
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel: string;
    danger?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { open, title, body, confirmLabel, cancelLabel, danger = false, onconfirm, oncancel }: Props =
    $props();
</script>

<!-- Focus starts on Cancel: Enter on a destructive dialog must not confirm. -->
<Modal {open} {title} {danger} {oncancel} initialFocus="[data-cancel]">
  <p>{body}</p>
  {#snippet actions()}
    <Button data-cancel onclick={oncancel}>{cancelLabel}</Button>
    <Button variant={danger ? 'danger' : 'primary'} onclick={onconfirm}>{confirmLabel}</Button>
  {/snippet}
</Modal>

<style>
  p {
    margin: 0;
    color: var(--fg-muted);
    line-height: 1.55;
  }
</style>

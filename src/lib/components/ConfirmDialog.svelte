<script lang="ts">
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

  let dialog: HTMLDialogElement | undefined = $state();

  // showModal() gives the focus trap and Esc handling for free — no library,
  // and it is the native behaviour docs/06 §5 asks for.
  $effect(() => {
    if (dialog === undefined) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} oncancel={oncancel} onclose={oncancel} aria-label={title}>
  <h2>{title}</h2>
  <p>{body}</p>
  <div class="actions">
    <button class="cancel" onclick={oncancel}>{cancelLabel}</button>
    <button class:danger onclick={onconfirm}>{confirmLabel}</button>
  </div>
</dialog>

<style>
  dialog {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--fg);
    padding: var(--sp-4);
    max-width: 44ch;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }

  h2 {
    margin: 0 0 var(--sp-2);
    font-size: var(--fs-3);
  }

  p {
    margin: 0 0 var(--sp-4);
    color: var(--fg-muted);
    font-size: var(--fs-1);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-2);
  }

  button {
    font: inherit;
    padding: var(--sp-2) var(--sp-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-raised);
    color: var(--fg);
    cursor: pointer;
  }

  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }
</style>

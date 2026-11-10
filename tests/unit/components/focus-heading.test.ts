import { afterEach, describe, expect, it } from 'vitest';
import {
  focusIfLost,
  focusLost,
  focusOwningTree,
  focusWhenShown,
} from '@/lib/components/focus-heading';

/** Focus repair for multi-step screens and deletes — docs/06 §5. */
afterEach(() => {
  document.body.replaceChildren();
});

function button(parent: HTMLElement = document.body): HTMLButtonElement {
  return parent.appendChild(document.createElement('button'));
}

describe('focusLost', () => {
  it('is true on <body>, false on a live control', () => {
    expect(focusLost()).toBe(true);
    button().focus();
    expect(focusLost()).toBe(false);
  });

  it('counts a control inside a closed dialog as lost — the browser moves it later', () => {
    const dialog = document.body.appendChild(document.createElement('dialog'));
    dialog.setAttribute('open', '');
    const confirm = button(dialog);
    confirm.focus();
    expect(focusLost()).toBe(false);
    dialog.removeAttribute('open');
    expect(focusLost()).toBe(true);
  });
});

describe('focusIfLost', () => {
  it('moves a lost focus to the target, and leaves a live one alone', () => {
    const target = button();
    focusIfLost(target);
    expect(document.activeElement).toBe(target);
    const other = button();
    other.focus();
    focusIfLost(target);
    expect(document.activeElement).toBe(other);
    focusIfLost(undefined);
    expect(document.activeElement).toBe(other);
  });
});

describe('focusWhenShown', () => {
  it('takes focus inside its scope or when lost, never from elsewhere', () => {
    const scope = document.body.appendChild(document.createElement('div'));
    scope.setAttribute('data-focus-scope', '');
    const heading = scope.appendChild(document.createElement('h2'));
    heading.tabIndex = -1;
    const outside = button();
    outside.focus();
    focusWhenShown(heading);
    expect(document.activeElement).toBe(outside);
    button(scope).focus();
    focusWhenShown(heading);
    expect(document.activeElement).toBe(heading);
  });
});

describe('focusOwningTree', () => {
  function tree(): { tree: HTMLElement; rowButton: HTMLButtonElement } {
    const list = document.body.appendChild(document.createElement('ul'));
    list.setAttribute('role', 'tree');
    list.tabIndex = 0;
    const item = list.appendChild(document.createElement('li'));
    const rowButton = button(item);
    rowButton.tabIndex = -1;
    return { tree: list, rowButton };
  }

  it('moves focus from a clicked row control to the tree it sits in', () => {
    // Chrome focuses a tabindex="-1" button on click, and the tree ignores keys
    // aimed at a row's own control — the arrow keys went dead (docs/06 §5).
    const { tree: list, rowButton } = tree();
    rowButton.focus();
    expect(document.activeElement).toBe(rowButton);
    focusOwningTree(rowButton);
    expect(document.activeElement).toBe(list);
  });

  it('does nothing for a control outside a tree, or for no target at all', () => {
    const outside = button();
    outside.focus();
    focusOwningTree(outside);
    expect(document.activeElement).toBe(outside);
    expect(() => focusOwningTree(null)).not.toThrow();
    expect(document.activeElement).toBe(outside);
  });
});

// A combobox (ARIA pattern "combobox with listbox popup") over a native <select> of the gallery form: the select stays
// in the form, hidden, as the only state (its options, counts, the offered ones and the greyed state are kept by the
// gallery script); the combobox lists those options, narrows them as the visitor types (scripts/lib/combobox.mjs)
// and picks one by setting the select and firing its change event. What is typed is never part of the state.
// Keys: ↓/↑ open the list and move, Enter picks, Esc closes (and keeps the panel of the filters open), Tab leaves.
import { comboMatches, nextActive, typedActive } from '../../scripts/lib/combobox.mjs';

let seq = 0;

/**
 * Turns `select` into a combobox; `keep` = how many first options are never searched for ("vše", "žádná").
 * Returns { sync } to call after the gallery rebuilt the select's options, value or disabled state.
 */
export function selectCombobox(select: HTMLSelectElement, { keep = 1, placeholder = '' } = {}) {
  const id = `combo-${++seq}`;
  const wrap = Object.assign(document.createElement('span'), { className: 'combo' });
  const input = Object.assign(document.createElement('input'), {
    type: 'text', className: 'combo-input', autocomplete: 'off', spellcheck: false, placeholder,
  });
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', `${id}-list`);
  const list = Object.assign(document.createElement('ul'), { id: `${id}-list`, className: 'combo-list', hidden: true });
  list.setAttribute('role', 'listbox');
  select.before(wrap);
  wrap.append(input, list, select);
  select.hidden = true;
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  let open = false;
  let typed: string | null = null; // null = not typing, the input shows the picked option
  let shown: HTMLOptionElement[] = [];
  let active = -1;

  const options = () => [...select.options];
  const label = (o: HTMLOptionElement) => o.dataset.label ?? o.textContent ?? '';
  const display = () => select.selectedOptions[0]?.textContent ?? '';

  function render() {
    const all = options();
    shown = (typed ? comboMatches(all.map(label), typed, keep) : all.map((_, i) => i)).map((i) => all[i]);
    list.replaceChildren(...shown.map((o, i) => {
      const li = document.createElement('li');
      li.id = `${id}-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(o.selected));
      li.className = i === active ? 'active' : '';
      li.textContent = o.textContent;
      li.dataset.index = String(i);
      return li;
    }));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', `${id}-${active}`);
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function show() {
    if (open || select.disabled) return;
    open = true;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = Math.max(0, options().findIndex((o) => o.selected));
    render();
  }
  function hide() {
    open = false;
    typed = null;
    active = -1;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    input.value = display();
  }
  function pick(option: HTMLOptionElement | undefined) {
    hide();
    if (!option || option.value === select.value) return;
    select.value = option.value;
    input.value = display();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Opening selects the whole text, so typing replaces it (as after Tab, also after a click of the mouse).
  input.addEventListener('click', () => {
    if (open) { hide(); return; }
    show();
    input.select();
  });
  input.addEventListener('input', () => {
    typed = input.value;
    if (!open) show();
    active = typedActive(comboMatches(options().map(label), typed, keep), typed, keep);
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { show(); return; }
      active = nextActive(active, e.key === 'ArrowDown' ? 1 : -1, shown.length);
      render();
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape' && open) {
      // Closes only the list; the panel of the filters stays open.
      e.preventDefault();
      e.stopPropagation();
      hide();
    } else if (e.key === 'Tab' && open) hide();
  });
  // A click in the list keeps the focus in the input, so leaving the input means leaving the combobox.
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-index]');
    if (li) pick(shown[Number(li.dataset.index)]);
  });
  input.addEventListener('blur', () => { if (open) hide(); });

  /** After the select changed from outside (filters, the bar, a link): its text, the greyed state, the open list. */
  function sync() {
    input.disabled = select.disabled;
    if (select.disabled && open) hide();
    if (typed === null) input.value = display();
    if (open) render();
  }
  sync();
  return { sync };
}

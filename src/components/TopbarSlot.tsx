import { createSignal, Show, type ParentComponent } from 'solid-js';
import { Portal } from 'solid-js/web';

// Місце праворуч у верхній панелі телефона (навпроти логотипа): сторінка кладе туди свої кнопки.
// На комп'ютері верхньої панелі немає — там ті самі кнопки стоять у шапці сторінки.

const [slot, setSlot] = createSignal<HTMLElement>();

/** Ставиться в Layout у верхню панель */
export const TopbarSlotTarget = () => <div class="topbar-actions" ref={setSlot} />;

/** Вміст переноситься у верхню панель */
export const TopbarActions: ParentComponent = (props) => (
  <Show when={slot()}>{(el) => <Portal mount={el()}>{props.children}</Portal>}</Show>
);

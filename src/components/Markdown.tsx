import { createMemo } from 'solid-js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

export default function Markdown(props: { text: string }) {
  const html = createMemo(() => DOMPurify.sanitize(marked.parse(props.text, { async: false }) as string));
  return <div class="md" innerHTML={html()} />;
}

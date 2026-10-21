// Читання ZIP-архіву без сторонніх бібліотек: центральний каталог + DecompressionStream('deflate-raw').
// Підтримуються методи STORE (0) і DEFLATE (8) — їх створюють Windows, macOS, 7-Zip і наш експорт.

export interface UnzippedFile {
  path: string;
  content: string;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Повертає текстові файли архіву, шлях яких задовольняє фільтр */
export async function readZip(file: Blob, accept: (path: string) => boolean): Promise<UnzippedFile[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);

  // Кінець центрального каталогу шукаємо з кінця файлу (після нього може бути коментар)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip');

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder('utf-8');
  const cp866 = (() => {
    try {
      return new TextDecoder('ibm866');
    } catch {
      return utf8;
    }
  })();
  const out: UnzippedFile[] = [];

  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error('broken zip');
    const flags = view.getUint16(ptr + 8, true);
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
    // Біт 11 — UTF-8; інакше старі архіватори Windows пишуть кирилицю в CP866
    const path = (flags & 0x0800 ? utf8 : cp866).decode(nameBytes).replace(/\\/g, '/');
    ptr += 46 + nameLen + extraLen + commentLen;

    if (path.endsWith('/') || !accept(path)) continue;

    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(start, start + compSize);

    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error(`unsupported zip method ${method} (${path})`);

    out.push({ path, content: utf8.decode(data) });
  }
  return out;
}

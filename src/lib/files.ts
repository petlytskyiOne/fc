// Збереження згенерованих файлів: у браузері — завантаження, на Android — файл у кеші + системне «Поділитися».
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ExportFile } from './export';

export const isNative = () => Capacitor.isNativePlatform();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function saveFile(file: ExportFile): Promise<void> {
  const binary = file.content instanceof Uint8Array;
  if (isNative()) {
    // Двійкові файли Filesystem приймає в base64, текстові — як UTF-8
    const written = await Filesystem.writeFile(
      binary
        ? { path: file.name, data: toBase64(file.content as Uint8Array), directory: Directory.Cache }
        : { path: file.name, data: file.content as string, directory: Directory.Cache, encoding: Encoding.UTF8 },
    );
    await Share.share({ title: file.name, files: [written.uri] });
    return;
  }

  const blob = new Blob([file.content as BlobPart], { type: binary ? file.mime : `${file.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Друк / «Зберегти як PDF» у браузері: документ друкується з прихованого iframe */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.srcdoc = html;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => {
        frame.remove();
        resolve();
      }, 1000);
    };
    document.body.appendChild(frame);
  });
}

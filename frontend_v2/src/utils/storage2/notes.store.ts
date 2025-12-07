// src/utils/storage/notes.store.ts
import { storage } from "./port";
import { Key } from "./keys";
import type { NoteItem } from "./types";

export const NoteStore = {
  load(acc: string): NoteItem[] {
    if (!acc) return [];
    try { return JSON.parse(storage.getItem(Key.notes(acc)) || "[]"); } catch { return []; }
  },
  save(acc: string, list: NoteItem[]) {
    if (!acc) return;
    storage.setItem(Key.notes(acc), JSON.stringify(list));
  },
};

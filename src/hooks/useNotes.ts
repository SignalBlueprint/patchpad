import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import type { Note, Folder, Highlight, HighlightColor } from '../types/note';
import { updateLinksOnRename } from '../utils/linkParser';
import { storeAudioForNote, deleteAudioForNote } from '../services/audioStorage';

function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0].trim();
  // Remove markdown heading markers
  const cleaned = firstLine.replace(/^#+\s*/, '').trim();
  return cleaned || 'Untitled';
}

export type SortOption = 'updated' | 'created' | 'title' | 'favorite';
export type FilterOption = 'all' | 'favorites' | 'folder' | 'tag';

export interface NotesFilter {
  type: FilterOption;
  value?: string; // folder id or tag name
}

export function useNotes(searchQuery?: string, filter?: NotesFilter, sortBy: SortOption = 'updated') {
  const notes = useLiveQuery(async () => {
    let allNotes = await db.notes.toArray();

    // Apply filters
    if (filter) {
      switch (filter.type) {
        case 'favorites':
          allNotes = allNotes.filter(n => n.favorite);
          break;
        case 'folder':
          if (filter.value) {
            allNotes = allNotes.filter(n => n.folder === filter.value);
          } else {
            // No folder = root level notes
            allNotes = allNotes.filter(n => !n.folder);
          }
          break;
        case 'tag':
          if (filter.value) {
            allNotes = allNotes.filter(n => n.tags?.includes(filter.value!));
          }
          break;
      }
    }

    // Apply search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      allNotes = allNotes.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    allNotes.sort((a, b) => {
      // Always show favorites first if sorting by favorite
      if (sortBy === 'favorite') {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
      }

      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'updated':
        case 'favorite':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    return allNotes;
  }, [searchQuery, filter?.type, filter?.value, sortBy]);

  const folders = useLiveQuery(() => db.folders.toArray(), []);

  const allTags = useLiveQuery(async () => {
    const allNotes = await db.notes.toArray();
    const tagSet = new Set<string>();
    allNotes.forEach(note => {
      note.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, []);

  const createNote = async (initialContent?: string, initialTitle?: string, folderId?: string, initialTags?: string[]): Promise<string> => {
    const now = new Date();
    const note: Note = {
      id: uuidv4(),
      title: initialTitle ?? 'Untitled',
      content: initialContent ?? '',
      createdAt: now,
      updatedAt: now,
      folder: folderId,
      favorite: false,
      tags: initialTags ?? [],
    };
    await db.notes.add(note);
    return note.id;
  };

  const updateNote = async (id: string, content: string): Promise<void> => {
    const note = await db.notes.get(id);
    const oldTitle = note?.title;
    const newTitle = extractTitle(content);

    await db.notes.update(id, {
      content,
      title: newTitle,
      updatedAt: new Date(),
    });

    // Update wiki links in other notes if title changed
    if (oldTitle && oldTitle !== newTitle) {
      await updateWikiLinksAcrossNotes(oldTitle, newTitle, id);
    }
  };

  const renameNote = async (id: string, newTitle: string): Promise<void> => {
    const note = await db.notes.get(id);
    const oldTitle = note?.title;

    await db.notes.update(id, {
      title: newTitle,
      updatedAt: new Date(),
    });

    // Update wiki links in other notes
    if (oldTitle && oldTitle !== newTitle) {
      await updateWikiLinksAcrossNotes(oldTitle, newTitle, id);
    }
  };

  // Update all wiki links across notes when a note is renamed
  const updateWikiLinksAcrossNotes = async (oldTitle: string, newTitle: string, excludeNoteId: string): Promise<void> => {
    const allNotes = await db.notes.toArray();

    for (const note of allNotes) {
      if (note.id === excludeNoteId) continue;

      const updatedContent = updateLinksOnRename(oldTitle, newTitle, note.content);
      if (updatedContent !== note.content) {
        await db.notes.update(note.id, {
          content: updatedContent,
          updatedAt: new Date(),
        });
      }
    }
  };

  const deleteNote = async (id: string): Promise<void> => {
    await db.notes.delete(id);
  };

  const getNote = async (id: string): Promise<Note | undefined> => {
    return db.notes.get(id);
  };

  const toggleFavorite = async (id: string): Promise<void> => {
    const note = await db.notes.get(id);
    if (note) {
      await db.notes.update(id, {
        favorite: !note.favorite,
        updatedAt: new Date(),
      });
    }
  };

  const setNoteFolder = async (id: string, folderId: string | undefined): Promise<void> => {
    await db.notes.update(id, {
      folder: folderId,
      updatedAt: new Date(),
    });
  };

  const addNoteTag = async (id: string, tag: string): Promise<void> => {
    const note = await db.notes.get(id);
    if (note) {
      const tags = note.tags || [];
      if (!tags.includes(tag)) {
        await db.notes.update(id, {
          tags: [...tags, tag],
          updatedAt: new Date(),
        });
      }
    }
  };

  const removeNoteTag = async (id: string, tag: string): Promise<void> => {
    const note = await db.notes.get(id);
    if (note) {
      await db.notes.update(id, {
        tags: (note.tags || []).filter(t => t !== tag),
        updatedAt: new Date(),
      });
    }
  };

  // Folder operations
  const createFolder = async (name: string, color?: string): Promise<string> => {
    const folder: Folder = {
      id: uuidv4(),
      name,
      color,
    };
    await db.folders.add(folder);
    return folder.id;
  };

  const renameFolder = async (id: string, name: string): Promise<void> => {
    await db.folders.update(id, { name });
  };

  const deleteFolder = async (id: string): Promise<void> => {
    // Move all notes in this folder to root
    const notesInFolder = await db.notes.where('folder').equals(id).toArray();
    for (const note of notesInFolder) {
      await db.notes.update(note.id, { folder: undefined });
    }
    await db.folders.delete(id);
  };

  // Highlight operations
  const addHighlight = async (noteId: string, from: number, to: number, color: HighlightColor, annotation?: string): Promise<string> => {
    const note = await db.notes.get(noteId);
    if (!note) return '';

    const highlight: Highlight = {
      id: uuidv4(),
      from,
      to,
      color,
      note: annotation,
    };

    const highlights = note.highlights || [];
    await db.notes.update(noteId, {
      highlights: [...highlights, highlight],
      updatedAt: new Date(),
    });

    return highlight.id;
  };

  const removeHighlight = async (noteId: string, highlightId: string): Promise<void> => {
    const note = await db.notes.get(noteId);
    if (!note) return;

    await db.notes.update(noteId, {
      highlights: (note.highlights || []).filter(h => h.id !== highlightId),
      updatedAt: new Date(),
    });
  };

  const updateHighlightAnnotation = async (noteId: string, highlightId: string, annotation: string): Promise<void> => {
    const note = await db.notes.get(noteId);
    if (!note) return;

    const highlights = (note.highlights || []).map(h =>
      h.id === highlightId ? { ...h, note: annotation } : h
    );

    await db.notes.update(noteId, {
      highlights,
      updatedAt: new Date(),
    });
  };

  // Parent-child operations for merged notes
  const setNoteParent = async (noteId: string, parentId: string | undefined): Promise<void> => {
    await db.notes.update(noteId, {
      parentId,
      updatedAt: new Date(),
    });
  };

  const setNotesParent = async (noteIds: string[], parentId: string): Promise<void> => {
    for (const id of noteIds) {
      await db.notes.update(id, {
        parentId,
        updatedAt: new Date(),
      });
    }
  };

  const toggleNoteCollapsed = async (noteId: string): Promise<void> => {
    const note = await db.notes.get(noteId);
    if (note) {
      await db.notes.update(noteId, {
        collapsed: !note.collapsed,
      });
    }
  };

  const getChildNotes = async (parentId: string): Promise<Note[]> => {
    return db.notes.where('parentId').equals(parentId).toArray();
  };

  // Audio operations for voice notes
  const setNoteAudio = async (noteId: string, audioBlob: Blob, duration: number): Promise<string> => {
    // Store the audio blob
    const audioId = await storeAudioForNote(noteId, audioBlob, duration);

    // Update the note with the audio ID
    await db.notes.update(noteId, {
      audioId,
      updatedAt: new Date(),
    });

    return audioId;
  };

  const removeNoteAudio = async (noteId: string): Promise<void> => {
    // Delete from audio storage
    await deleteAudioForNote(noteId);

    // Update the note to remove audio ID
    await db.notes.update(noteId, {
      audioId: undefined,
      updatedAt: new Date(),
    });
  };

  return {
    notes: notes ?? [],
    folders: folders ?? [],
    allTags: allTags ?? [],
    createNote,
    updateNote,
    renameNote,
    deleteNote,
    getNote,
    toggleFavorite,
    setNoteFolder,
    addNoteTag,
    removeNoteTag,
    createFolder,
    renameFolder,
    deleteFolder,
    addHighlight,
    removeHighlight,
    updateHighlightAnnotation,
    setNoteParent,
    setNotesParent,
    toggleNoteCollapsed,
    getChildNotes,
    setNoteAudio,
    removeNoteAudio,
  };
}

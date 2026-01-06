import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLinkSuggestions } from './useLinkSuggestions';
import type { Note } from '../types/note';

const createMockNote = (id: string, title: string, content: string = ''): Note => ({
  id,
  title,
  content,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('useLinkSuggestions', () => {
  it('should suggest link for exact title match', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
      createMockNote('2', 'Another Note', 'Some content'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'I discussed Project Phoenix yesterday.',
        notes,
        enabled: true,
        idleTimeout: 50, // Short timeout for testing
      })
    );

    // Trigger idle detection by waiting
    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    expect(result.current.suggestions[0].term).toBe('Project Phoenix');
    expect(result.current.suggestions[0].noteId).toBe('1');
    expect(result.current.suggestions[0].noteTitle).toBe('Project Phoenix');
  });

  it('should not suggest already-linked text', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'I discussed [[Project Phoenix]] yesterday.',
        notes,
        enabled: true,
        idleTimeout: 50,
      })
    );

    // Wait for idle
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should have no suggestions since it's already linked
    expect(result.current.suggestions).toHaveLength(0);
  });

  it('should perform case-insensitive matching', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'I discussed project phoenix yesterday.',
        notes,
        enabled: true,
        idleTimeout: 50,
      })
    );

    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    expect(result.current.suggestions[0].noteTitle).toBe('Project Phoenix');
  });

  it('should not suggest duplicate terms', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'Project Phoenix is great. Project Phoenix is also good.',
        notes,
        enabled: true,
        idleTimeout: 50,
      })
    );

    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    // Should only have one suggestion despite multiple occurrences
    expect(result.current.suggestions).toHaveLength(1);
  });

  it('should not re-suggest dismissed suggestions', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
    ];

    const { result, rerender } = renderHook(
      ({ content }) =>
        useLinkSuggestions({
          content,
          notes,
          enabled: true,
          idleTimeout: 50,
        }),
      { initialProps: { content: 'I discussed Project Phoenix yesterday.' } }
    );

    // Wait for initial suggestion
    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    // Dismiss the suggestion
    act(() => {
      result.current.dismissSuggestion('Project Phoenix');
    });

    expect(result.current.suggestions).toHaveLength(0);

    // Rerender with same content - should not show suggestion again
    rerender({ content: 'I discussed Project Phoenix again today.' });

    // Wait a bit for idle detection
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dismissed suggestion should not reappear
    expect(result.current.suggestions).toHaveLength(0);
  });

  it('should return empty suggestions when disabled', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'I discussed Project Phoenix yesterday.',
        notes,
        enabled: false,
        idleTimeout: 50,
      })
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(result.current.suggestions).toHaveLength(0);
  });

  it('should only match whole words', async () => {
    const notes = [
      createMockNote('1', 'Test', 'A test note'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'Testing the system with a contest.',
        notes,
        enabled: true,
        idleTimeout: 50,
      })
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should NOT match "Test" within "Testing" or "contest"
    expect(result.current.suggestions).toHaveLength(0);
  });

  it('should match whole words', async () => {
    const notes = [
      createMockNote('1', 'Test', 'A test note'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'Running a Test today.',
        notes,
        enabled: true,
        idleTimeout: 50,
      })
    );

    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    expect(result.current.suggestions[0].noteTitle).toBe('Test');
  });

  it('should remove suggestion when acceptSuggestion is called', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
      createMockNote('2', 'Another Note', 'Some content'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'I discussed Project Phoenix and Another Note yesterday.',
        notes,
        enabled: true,
        idleTimeout: 50,
      })
    );

    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    const initialCount = result.current.suggestions.length;

    act(() => {
      result.current.acceptSuggestion('Project Phoenix');
    });

    expect(result.current.suggestions.length).toBe(initialCount - 1);
  });

  it('should clear all suggestions', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
      createMockNote('2', 'Another Note', 'Some content'),
    ];

    const { result } = renderHook(() =>
      useLinkSuggestions({
        content: 'I discussed Project Phoenix and Another Note yesterday.',
        notes,
        enabled: true,
        idleTimeout: 50,
      })
    );

    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    act(() => {
      result.current.clearSuggestions();
    });

    expect(result.current.suggestions).toHaveLength(0);
  });

  it('should reset dismissed terms', async () => {
    const notes = [
      createMockNote('1', 'Project Phoenix', 'A project description'),
    ];

    const { result, rerender } = renderHook(
      ({ content }) =>
        useLinkSuggestions({
          content,
          notes,
          enabled: true,
          idleTimeout: 50,
        }),
      { initialProps: { content: 'I discussed Project Phoenix yesterday.' } }
    );

    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    // Dismiss and verify it's gone
    act(() => {
      result.current.dismissSuggestion('Project Phoenix');
    });

    expect(result.current.suggestions).toHaveLength(0);

    // Reset dismissed terms
    act(() => {
      result.current.resetDismissed();
    });

    // Trigger a new scan by changing content slightly
    rerender({ content: 'I discussed Project Phoenix again.' });

    await waitFor(
      () => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    // Should show suggestion again after reset
    expect(result.current.suggestions[0].noteTitle).toBe('Project Phoenix');
  });
});

import { describe, it, expect } from 'vitest';
import { applyOps } from './applyOps';
import type { PatchOp } from '../types/patch';

describe('applyOps', () => {
  describe('insert operations', () => {
    it('inserts text at the beginning', () => {
      const content = 'Hello';
      const ops: PatchOp[] = [{ type: 'insert', start: 0, text: 'Say: ' }];
      expect(applyOps(content, ops)).toBe('Say: Hello');
    });

    it('inserts text at the end', () => {
      const content = 'Hello';
      const ops: PatchOp[] = [{ type: 'insert', start: 5, text: ' World' }];
      expect(applyOps(content, ops)).toBe('Hello World');
    });

    it('inserts text in the middle', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'insert', start: 5, text: ' Beautiful' }];
      expect(applyOps(content, ops)).toBe('Hello Beautiful World');
    });

    it('handles multiple inserts at different positions', () => {
      const content = 'AC';
      const ops: PatchOp[] = [
        { type: 'insert', start: 1, text: 'B' },
        { type: 'insert', start: 2, text: 'D' },
      ];
      // Applied in reverse order (by start index descending):
      // 1. Insert 'D' at position 2: 'AC' -> 'ACD'
      // 2. Insert 'B' at position 1: 'ACD' -> 'ABCD'
      expect(applyOps(content, ops)).toBe('ABCD');
    });

    it('handles empty text insert', () => {
      const content = 'Hello';
      const ops: PatchOp[] = [{ type: 'insert', start: 2 }];
      expect(applyOps(content, ops)).toBe('Hello');
    });
  });

  describe('delete operations', () => {
    it('deletes text from the beginning', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'delete', start: 0, end: 6 }];
      expect(applyOps(content, ops)).toBe('World');
    });

    it('deletes text from the end', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'delete', start: 5, end: 11 }];
      expect(applyOps(content, ops)).toBe('Hello');
    });

    it('deletes text from the middle', () => {
      const content = 'Hello Beautiful World';
      const ops: PatchOp[] = [{ type: 'delete', start: 5, end: 15 }];
      expect(applyOps(content, ops)).toBe('Hello World');
    });

    it('handles delete with missing end (no-op)', () => {
      const content = 'Hello';
      const ops: PatchOp[] = [{ type: 'delete', start: 2 }];
      expect(applyOps(content, ops)).toBe('Hello');
    });
  });

  describe('replace operations', () => {
    it('replaces text at the beginning', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'replace', start: 0, end: 5, text: 'Hi' }];
      expect(applyOps(content, ops)).toBe('Hi World');
    });

    it('replaces text at the end', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'replace', start: 6, end: 11, text: 'Universe' }];
      expect(applyOps(content, ops)).toBe('Hello Universe');
    });

    it('replaces text in the middle', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'replace', start: 5, end: 6, text: ', ' }];
      expect(applyOps(content, ops)).toBe('Hello, World');
    });

    it('replaces entire content', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'replace', start: 0, end: 11, text: 'Goodbye' }];
      expect(applyOps(content, ops)).toBe('Goodbye');
    });

    it('handles replace with empty text (deletion)', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [{ type: 'replace', start: 5, end: 11, text: '' }];
      expect(applyOps(content, ops)).toBe('Hello');
    });
  });

  describe('mixed operations', () => {
    it('handles insert and delete together', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [
        { type: 'delete', start: 0, end: 6 }, // Remove "Hello "
        { type: 'insert', start: 11, text: '!' }, // Add "!" at end
      ];
      // Applied in reverse: insert ! at 11 first, then delete 0-6
      expect(applyOps(content, ops)).toBe('World!');
    });

    it('handles multiple operations in correct order', () => {
      const content = 'ABCDEF';
      const ops: PatchOp[] = [
        { type: 'replace', start: 0, end: 1, text: 'X' }, // A -> X
        { type: 'replace', start: 3, end: 4, text: 'Y' }, // D -> Y
        { type: 'replace', start: 5, end: 6, text: 'Z' }, // F -> Z
      ];
      expect(applyOps(content, ops)).toBe('XBCYEZ');
    });
  });

  describe('edge cases', () => {
    it('handles empty content', () => {
      const content = '';
      const ops: PatchOp[] = [{ type: 'insert', start: 0, text: 'Hello' }];
      expect(applyOps(content, ops)).toBe('Hello');
    });

    it('handles empty operations array', () => {
      const content = 'Hello World';
      const ops: PatchOp[] = [];
      expect(applyOps(content, ops)).toBe('Hello World');
    });

    it('handles multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const ops: PatchOp[] = [{ type: 'insert', start: 7, text: 'New ' }];
      expect(applyOps(content, ops)).toBe('Line 1\nNew Line 2\nLine 3');
    });
  });
});

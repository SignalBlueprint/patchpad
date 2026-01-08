/**
 * Session Export Service
 *
 * Exports thinking sessions as self-contained HTML files for sharing.
 * The exported HTML includes a built-in player and all session data.
 */

import type { ThinkingSession, SessionStats } from '../types/session';
import { getSessionStats } from './sessionRecorder';

/**
 * Generate a standalone HTML file containing the session player and data
 */
export function exportSessionAsHTML(
  session: ThinkingSession,
  options: {
    includeNoteContent?: boolean;
    noteExcerptLength?: number;
    theme?: 'light' | 'dark';
  } = {}
): string {
  const {
    includeNoteContent = true,
    noteExcerptLength = 200,
    theme = 'light',
  } = options;

  const stats = getSessionStats(session);
  const sessionData = JSON.stringify(session);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.title)} - PatchPad Session</title>
  <style>
    ${getPlayerStyles(theme)}
  </style>
</head>
<body class="${theme}">
  <div id="app">
    ${generatePlayerHTML(session, stats)}
  </div>

  <script>
    const SESSION_DATA = ${sessionData};
    ${getPlayerScript()}
  </script>
</body>
</html>`;
}

/**
 * Download session as HTML file
 */
export function downloadSessionAsHTML(
  session: ThinkingSession,
  options?: Parameters<typeof exportSessionAsHTML>[1]
): void {
  const html = exportSessionAsHTML(session, options);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(session.title)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generate shareable URL with embedded session data (base64)
 * Note: This is for small sessions only due to URL length limits
 */
export function generateShareableURL(session: ThinkingSession): string | null {
  try {
    const compressed = compressSession(session);
    const encoded = btoa(compressed);

    // Check if URL would be too long (most browsers support ~2000 chars)
    if (encoded.length > 1500) {
      return null;
    }

    return `${window.location.origin}/session?data=${encoded}`;
  } catch {
    return null;
  }
}

/**
 * Compress session for sharing (removes non-essential data)
 */
function compressSession(session: ThinkingSession): string {
  const minimal = {
    t: session.title,
    d: session.durationMs,
    e: session.events.map(e => ({
      y: e.type[0], // First char of type
      s: e.timestamp,
      p: e.payload,
    })),
    a: session.annotations.map(a => ({
      s: a.timestamp,
      c: a.content,
    })),
  };
  return JSON.stringify(minimal);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9\s-_]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50) || 'session';
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function generatePlayerHTML(session: ThinkingSession, stats: SessionStats): string {
  const formattedDate = new Date(session.startedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <div class="player-container">
      <header class="player-header">
        <div class="logo">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span>PatchPad Session</span>
        </div>
        <div class="session-info">
          <h1>${escapeHtml(session.title)}</h1>
          <p class="date">${formattedDate}</p>
        </div>
      </header>

      <main class="player-main">
        <div class="timeline-section">
          <div class="time-display">
            <span id="current-time">0:00</span>
            <span class="separator">/</span>
            <span id="total-time">${formatDuration(session.durationMs)}</span>
          </div>

          <div class="timeline" id="timeline">
            <div class="timeline-progress" id="timeline-progress"></div>
            <div class="timeline-playhead" id="timeline-playhead"></div>
            ${session.annotations.map(a => `
              <div class="annotation-marker"
                   style="left: ${(a.timestamp / session.durationMs) * 100}%"
                   title="${escapeHtml(a.content)}">
              </div>
            `).join('')}
          </div>
        </div>

        <div class="controls">
          <button id="prev-btn" class="control-btn" title="Previous event">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          <button id="play-btn" class="control-btn play" title="Play/Pause">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" id="play-icon">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          <button id="next-btn" class="control-btn" title="Next event">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>

          <div class="speed-controls">
            <button class="speed-btn" data-speed="0.5">0.5x</button>
            <button class="speed-btn active" data-speed="1">1x</button>
            <button class="speed-btn" data-speed="2">2x</button>
            <button class="speed-btn" data-speed="4">4x</button>
          </div>
        </div>

        <div class="current-event" id="current-event">
          <p class="event-placeholder">Press play to start</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.notesCreated}</div>
            <div class="stat-label">Notes Created</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.notesEdited}</div>
            <div class="stat-label">Notes Edited</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.connectionsCreated}</div>
            <div class="stat-label">Connections</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.aiQueries}</div>
            <div class="stat-label">AI Queries</div>
          </div>
        </div>

        ${session.annotations.length > 0 ? `
          <div class="annotations-section">
            <h3>Annotations (${session.annotations.length})</h3>
            <div class="annotations-list">
              ${session.annotations.map(a => `
                <div class="annotation-item" data-timestamp="${a.timestamp}">
                  <span class="annotation-time">${formatDuration(a.timestamp)}</span>
                  <span class="annotation-type annotation-${a.type}">${a.type}</span>
                  <span class="annotation-content">${escapeHtml(a.content)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </main>

      <footer class="player-footer">
        <p>Recorded with <a href="https://patchpad.app" target="_blank">PatchPad</a></p>
        <p class="duration">Duration: ${formatDuration(session.durationMs)} • ${session.events.length} events</p>
      </footer>
    </div>
  `;
}

function getPlayerStyles(theme: 'light' | 'dark'): string {
  const colors = theme === 'dark'
    ? {
        bg: '#1a1a2e',
        surface: '#16213e',
        text: '#e4e4e7',
        textMuted: '#a1a1aa',
        primary: '#6366f1',
        primaryHover: '#4f46e5',
        border: '#27272a',
        accent: '#22d3ee',
      }
    : {
        bg: '#f4f4f5',
        surface: '#ffffff',
        text: '#18181b',
        textMuted: '#71717a',
        primary: '#6366f1',
        primaryHover: '#4f46e5',
        border: '#e4e4e7',
        accent: '#06b6d4',
      };

  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${colors.bg};
      color: ${colors.text};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .player-container {
      background: ${colors.surface};
      border-radius: 1rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      max-width: 600px;
      width: 100%;
      overflow: hidden;
    }

    .player-header {
      padding: 1.5rem;
      border-bottom: 1px solid ${colors.border};
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: ${colors.primary};
      font-weight: 600;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .session-info h1 {
      font-size: 1.25rem;
      margin-bottom: 0.25rem;
    }

    .date {
      font-size: 0.875rem;
      color: ${colors.textMuted};
    }

    .player-main {
      padding: 1.5rem;
    }

    .timeline-section {
      margin-bottom: 1.5rem;
    }

    .time-display {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: ${colors.textMuted};
      margin-bottom: 0.5rem;
    }

    .timeline {
      position: relative;
      height: 2rem;
      background: ${colors.border};
      border-radius: 0.5rem;
      cursor: pointer;
      overflow: hidden;
    }

    .timeline-progress {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      background: ${colors.primary}40;
      transition: width 0.1s ease;
    }

    .timeline-playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: ${colors.primary};
      transition: left 0.1s ease;
    }

    .annotation-marker {
      position: absolute;
      top: 0;
      width: 4px;
      height: 8px;
      background: ${colors.accent};
      border-radius: 0 0 2px 2px;
    }

    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .control-btn {
      background: ${colors.border};
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: ${colors.text};
      transition: all 0.2s;
    }

    .control-btn:hover {
      background: ${colors.primary}30;
    }

    .control-btn.play {
      width: 56px;
      height: 56px;
      background: ${colors.primary};
      color: white;
    }

    .control-btn.play:hover {
      background: ${colors.primaryHover};
    }

    .speed-controls {
      display: flex;
      gap: 0.25rem;
      margin-left: 1rem;
    }

    .speed-btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      background: transparent;
      border: 1px solid ${colors.border};
      border-radius: 0.25rem;
      color: ${colors.textMuted};
      cursor: pointer;
      transition: all 0.2s;
    }

    .speed-btn:hover, .speed-btn.active {
      background: ${colors.primary}20;
      border-color: ${colors.primary};
      color: ${colors.primary};
    }

    .current-event {
      padding: 1rem;
      background: ${colors.border};
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
      min-height: 80px;
    }

    .event-placeholder {
      color: ${colors.textMuted};
      text-align: center;
    }

    .event-icon {
      font-size: 1.5rem;
      margin-right: 0.5rem;
    }

    .event-type {
      font-weight: 600;
      text-transform: capitalize;
    }

    .event-time {
      font-size: 0.75rem;
      color: ${colors.textMuted};
      margin-left: 0.5rem;
    }

    .event-details {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: ${colors.textMuted};
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      text-align: center;
      padding: 0.75rem;
      background: ${colors.border};
      border-radius: 0.5rem;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: ${colors.primary};
    }

    .stat-label {
      font-size: 0.75rem;
      color: ${colors.textMuted};
    }

    .annotations-section h3 {
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
      color: ${colors.textMuted};
    }

    .annotations-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .annotation-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .annotation-item:hover {
      background: ${colors.border};
    }

    .annotation-time {
      color: ${colors.textMuted};
      font-size: 0.75rem;
      min-width: 40px;
    }

    .annotation-type {
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.625rem;
      text-transform: uppercase;
    }

    .annotation-note { background: #3b82f620; color: #3b82f6; }
    .annotation-highlight { background: #eab30820; color: #eab308; }
    .annotation-voice { background: #a855f720; color: #a855f7; }

    .annotation-content {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid ${colors.border};
      font-size: 0.75rem;
      color: ${colors.textMuted};
      display: flex;
      justify-content: space-between;
    }

    .player-footer a {
      color: ${colors.primary};
      text-decoration: none;
    }

    @media (max-width: 640px) {
      body { padding: 1rem; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;
}

function getPlayerScript(): string {
  return `
    (function() {
      const session = SESSION_DATA;
      let isPlaying = false;
      let currentTime = 0;
      let speed = 1;
      let animationFrame = null;
      let lastFrameTime = null;

      const timeline = document.getElementById('timeline');
      const progress = document.getElementById('timeline-progress');
      const playhead = document.getElementById('timeline-playhead');
      const currentTimeEl = document.getElementById('current-time');
      const playBtn = document.getElementById('play-btn');
      const playIcon = document.getElementById('play-icon');
      const prevBtn = document.getElementById('prev-btn');
      const nextBtn = document.getElementById('next-btn');
      const currentEventEl = document.getElementById('current-event');
      const speedBtns = document.querySelectorAll('.speed-btn');
      const annotationItems = document.querySelectorAll('.annotation-item');

      function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return minutes + ':' + secs.toString().padStart(2, '0');
      }

      function updateDisplay() {
        const progressPercent = (currentTime / session.durationMs) * 100;
        progress.style.width = progressPercent + '%';
        playhead.style.left = progressPercent + '%';
        currentTimeEl.textContent = formatTime(currentTime);

        // Find current event
        const events = session.events;
        let currentEvent = null;
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].timestamp <= currentTime) {
            currentEvent = events[i];
            break;
          }
        }

        if (currentEvent) {
          const icons = {
            'note-move': '↔️',
            'note-create': '📝',
            'note-edit': '✏️',
            'note-delete': '🗑️',
            'note-connect': '🔗',
            'viewport-change': '🔍',
            'ai-query': '🤖',
            'ai-response': '💬',
            'selection-change': '📋'
          };
          currentEventEl.innerHTML =
            '<span class="event-icon">' + (icons[currentEvent.type] || '•') + '</span>' +
            '<span class="event-type">' + currentEvent.type.replace('-', ' ') + '</span>' +
            '<span class="event-time">' + formatTime(currentEvent.timestamp) + '</span>' +
            '<div class="event-details">' + JSON.stringify(currentEvent.payload).slice(0, 100) + '</div>';
        }
      }

      function play() {
        if (currentTime >= session.durationMs) {
          currentTime = 0;
        }
        isPlaying = true;
        lastFrameTime = performance.now();
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
        animate();
      }

      function pause() {
        isPlaying = false;
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      }

      function animate() {
        if (!isPlaying) return;

        const now = performance.now();
        const delta = (now - lastFrameTime) * speed;
        lastFrameTime = now;

        currentTime = Math.min(currentTime + delta, session.durationMs);
        updateDisplay();

        if (currentTime >= session.durationMs) {
          pause();
        } else {
          animationFrame = requestAnimationFrame(animate);
        }
      }

      function seekTo(time) {
        currentTime = Math.max(0, Math.min(time, session.durationMs));
        updateDisplay();
      }

      function findEventIndex() {
        for (let i = 0; i < session.events.length; i++) {
          if (session.events[i].timestamp > currentTime) {
            return i;
          }
        }
        return session.events.length;
      }

      // Event listeners
      playBtn.addEventListener('click', function() {
        if (isPlaying) pause();
        else play();
      });

      prevBtn.addEventListener('click', function() {
        const idx = findEventIndex();
        if (idx > 0) {
          seekTo(session.events[idx - 1].timestamp);
        }
      });

      nextBtn.addEventListener('click', function() {
        const idx = findEventIndex();
        if (idx < session.events.length) {
          seekTo(session.events[idx].timestamp);
        }
      });

      timeline.addEventListener('click', function(e) {
        const rect = timeline.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        seekTo(percent * session.durationMs);
      });

      speedBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          speedBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          speed = parseFloat(btn.dataset.speed);
        });
      });

      annotationItems.forEach(function(item) {
        item.addEventListener('click', function() {
          seekTo(parseInt(item.dataset.timestamp));
        });
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === ' ') {
          e.preventDefault();
          if (isPlaying) pause();
          else play();
        } else if (e.key === 'ArrowLeft') {
          prevBtn.click();
        } else if (e.key === 'ArrowRight') {
          nextBtn.click();
        }
      });

      // Initial display
      updateDisplay();
    })();
  `;
}

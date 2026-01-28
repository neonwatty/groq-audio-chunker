/**
 * Simple logger for debug output
 */

const logsContainer = document.getElementById('logsContainer');

export function log(message, level = 'info') {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${level}`;
  entry.innerHTML = `<span class="log-time">[${time}]</span>${escapeHtml(message)}`;
  logsContainer.appendChild(entry);
  logsContainer.scrollTop = logsContainer.scrollHeight;

  // Also log to console
  const consoleFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
  consoleFn(`[${level.toUpperCase()}] ${message}`);
}

export function clearLogs() {
  logsContainer.innerHTML = '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

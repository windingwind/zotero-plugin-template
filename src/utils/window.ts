/**
 * Check if the window is alive.
 * Useful to prevent opening duplicate windows.
 * @param win
 */
export function isWindowAlive(win?: Window) {
  return win && !Components.utils.isDeadWrapper(win) && !win.closed;
}

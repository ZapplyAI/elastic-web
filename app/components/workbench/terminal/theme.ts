import type { ITheme } from '@xterm/xterm';

const style = getComputedStyle(document.documentElement);
const cssVar = (token: string) => style.getPropertyValue(token) || undefined;

export function getTerminalTheme(overrides?: ITheme): ITheme {
  return {
    cursor: cssVar('--elasticApp-elements-terminal-cursorColor'),
    cursorAccent: cssVar('--elasticApp-elements-terminal-cursorColorAccent'),
    foreground: cssVar('--elasticApp-elements-terminal-textColor'),
    background: cssVar('--elasticApp-elements-terminal-backgroundColor'),
    selectionBackground: cssVar('--elasticApp-elements-terminal-selection-backgroundColor'),
    selectionForeground: cssVar('--elasticApp-elements-terminal-selection-textColor'),
    selectionInactiveBackground: cssVar('--elasticApp-elements-terminal-selection-backgroundColorInactive'),

    // ansi escape code colors
    black: cssVar('--elasticApp-elements-terminal-color-black'),
    red: cssVar('--elasticApp-elements-terminal-color-red'),
    green: cssVar('--elasticApp-elements-terminal-color-green'),
    yellow: cssVar('--elasticApp-elements-terminal-color-yellow'),
    blue: cssVar('--elasticApp-elements-terminal-color-blue'),
    magenta: cssVar('--elasticApp-elements-terminal-color-magenta'),
    cyan: cssVar('--elasticApp-elements-terminal-color-cyan'),
    white: cssVar('--elasticApp-elements-terminal-color-white'),
    brightBlack: cssVar('--elasticApp-elements-terminal-color-brightBlack'),
    brightRed: cssVar('--elasticApp-elements-terminal-color-brightRed'),
    brightGreen: cssVar('--elasticApp-elements-terminal-color-brightGreen'),
    brightYellow: cssVar('--elasticApp-elements-terminal-color-brightYellow'),
    brightBlue: cssVar('--elasticApp-elements-terminal-color-brightBlue'),
    brightMagenta: cssVar('--elasticApp-elements-terminal-color-brightMagenta'),
    brightCyan: cssVar('--elasticApp-elements-terminal-color-brightCyan'),
    brightWhite: cssVar('--elasticApp-elements-terminal-color-brightWhite'),

    ...overrides,
  };
}

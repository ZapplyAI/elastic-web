import type { WebContainer, WebContainerProcess, SpawnOptions } from '@webcontainer/api';
import type { ITerminal } from '~/types/terminal';

export type ExecutionResult = { output: string; exitCode: number } | undefined;

interface TerminalWithResize extends ITerminal {
  onResize: (callback: (dimensions: { cols: number; rows: number }) => void) => void;
}

export class ElasticAppShell {
  #initialized: (() => void) | undefined;
  #readyPromise: Promise<void>;
  #process: WebContainerProcess | undefined;
  #terminal: ITerminal | undefined;

  constructor() {
    this.#readyPromise = new Promise((resolve) => {
      this.#initialized = resolve;
    });
  }

  async init(webcontainer: WebContainer, terminal: ITerminal) {
    const { process } = await this.newElasticAppShellProcess(webcontainer, terminal);
    this.#process = process;
    this.#terminal = terminal;
    this.#initialized?.();
  }

  async newElasticAppShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
    const options: SpawnOptions = {
      terminal: {
        cols: terminal.cols ?? 80,
        rows: terminal.rows ?? 24,
      },
    };

    const process = await webcontainer.spawn('bash', [], options);

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          // Log data being piped to terminal
          console.log('--- Piping to terminal.write() ---', data);

          terminal.write(data);
        },
      }),
    );

    const input = process.input.getWriter();
    terminal.onData((data) => {
      input.write(data);
    });

    if (this._isTerminalWithResize(terminal)) {
      terminal.onResize(({ cols, rows }) => {
        process.resize({ cols, rows });
      });
    }

    return { process };
  }

  private _isTerminalWithResize(terminal: ITerminal): terminal is TerminalWithResize {
    return 'onResize' in terminal;
  }

  async write(data: string) {
    await this.#readyPromise;
    const input = this.#process?.input.getWriter();
    input?.write(data);
    input?.releaseLock();
  }

  async clear() {
    await this.write('\x1b[2J\x1b[3J\x1b[;H');
  }
}

export function newElasticAppShellProcess() {
  return new ElasticAppShell();
}

export async function newShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
  const process = await webcontainer.spawn('bash', [], {
    terminal: {
      cols: terminal.cols ?? 80,
      rows: terminal.rows ?? 24,
    },
  });

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    }),
  );

  const input = process.input.getWriter();
  terminal.onData((data) => {
    input.write(data);
  });

  return process;
}

/**
 * Cleans and formats terminal output while preserving structure and paths
 * Handles ANSI, OSC, and various terminal control sequences
 */
export function cleanTerminalOutput(output: string) {
  return output
    .replace(/\x1b\[([0-9]{1,2}(;[0-9]{1,2})*)?[m|K]/g, '') // Remove ANSI color codes
    .replace(/\x1b\]654;[^\x07]+\x07/g, '') // Remove OSC codes
    .replace(/\x1b\[[0-9]+[A-Z]/g, '') // Remove ANSI cursor movement codes
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\u0000/g, ''); // Remove null characters
}

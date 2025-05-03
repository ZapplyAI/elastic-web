import { describe, expect, it, vi } from 'vitest';
import { StreamingMessageParser, type ActionCallback, type ArtifactCallback } from './message-parser';

interface ExpectedResult {
  output: string;
  callbacks: {
    onArtifactOpen: number;
    onArtifactClose: number;
    onActionOpen: number;
    onActionClose: number;
  };
}

describe('StreamingMessageParser', () => {
  it('should pass through normal text', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello, world!')).toBe('Hello, world!');
  });

  it('should allow normal HTML tags', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello <strong>world</strong>!')).toBe('Hello <strong>world</strong>!');
  });

  describe('no artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar', 'Foo bar'],
      ['Foo bar <', 'Foo bar '],
      ['Foo bar <p', 'Foo bar <p'],
      [['Foo bar <', 's', 'p', 'an>some text</span>'], 'Foo bar <span>some text</span>'],
    ])('should correctly parse chunks and strip out elastic app artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('invalid or incomplete artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar <e', 'Foo bar '],
      ['Foo bar <el', 'Foo bar '],
      ['Foo bar <elast', 'Foo bar '],
      ['Foo bar <elas', 'Foo bar '],
      ['Foo bar <elasticApp', 'Foo bar '],
      ['Foo bar <elasticAppArtifacs></elasticAppArtifact>', 'Foo bar <elasticAppArtifacs></elasticAppArtifact>'],
      ['Before <elasArtfiact>foo</elasticAppArtifact> After', 'Before <lasticAppArtfiact>foo</elasticAArtifact> After'],
      ['Before <Artifactt>foo</Artifact> After', 'Before <elasticAppArtifactt>foo</elasticAppArtifact> After'],
    ])('should correctly parse chunks and strip out elastic app artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts without actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Some text before <elasticAppArtifact title="Some title" id="artifact_1">foo bar</elasticAppArtifact> Some more text',
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <elasticAppArti',
          'fact title="Some title" id="artifact_1">foo bar</elasticAppArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <elasticAppArti',
          'fact title="Some title" id="artifact_1">foo bar</elasticAppArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <elasticAppArti',
          'fact title="Some title" id="artifact_1">foo bar</elasticAppArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <Arti',
          'fact title="Some title" id="artifact_1">foo bar</elasticAppArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <elasticAppArti',
          'fact title="Some title" id="artifact_1">foo bar</elasticAppArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        'Before <elasticAppArtifact title="Some title" id="artifact_1">foo</elasticAppArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
    ])('should correctly parse chunks and strip out elasticApp artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts with actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Before <elasticAppArtifact title="Some title" id="artifact_1"><elasticAppAction type="shell">npm install</elasticAppAction></elasticAppArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 1, onActionClose: 1 },
        },
      ],
      [
        'Before <elasticAppArtifact title="Some title" id="artifact_1"><elasticAppAction type="shell">npm install</elasticAppAction><elasticAppAction type="file" filePath="index.js">some content</elasticAppAction></elasticAppArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 2, onActionClose: 2 },
        },
      ],
    ])('should correctly parse chunks and strip out elasticApp artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });
});

function runTest(input: string | string[], expected: ExpectedResult | string) {
  const callbacks = {
    onArtifactOpen: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactOpen');
    }),
    onArtifactClose: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactClose');
    }),
    onActionOpen: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionOpen');
    }),
    onActionClose: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionClose');
    }),
  };

  const parser = new StreamingMessageParser({
    artifactElement: () => '',
    callbacks,
  });

  let message = '';

  if (Array.isArray(input)) {
    input.forEach((chunk) => {
      message += chunk;
      parser.parseChunk(chunk);
    });
  } else {
    message = input;
    parser.parseChunk(input);
  }

  if (typeof expected === 'string') {
    expect(message).toBe(expected);
  } else {
    expect(message).toBe(expected.output);

    for (const name of ['onArtifactOpen', 'onArtifactClose', 'onActionOpen', 'onActionClose']) {
      const callbackName = name;

      expect(callbacks[callbackName as keyof typeof callbacks]).toHaveBeenCalledTimes(
        expected.callbacks[callbackName as keyof typeof expected.callbacks] ?? 0,
      );
    }
  }
}

import { describe, expect, it } from 'vitest';
import { stripCodeFenceFromArtifact } from './Markdown';
import { render } from '@testing-library/react';
import Markdown from './Markdown';

describe('stripCodeFenceFromArtifact', () => {
  it('should remove code fences around artifact element', () => {
    const input = "```xml\n<div class='__elasticAppArtifact__'></div>\n```";
    const expected = "\n<div class='__elasticAppArtifact__'></div>\n";
    expect(stripCodeFenceFromArtifact(input)).toBe(expected);
  });

  it('should handle code fence with language specification', () => {
    const input = "```typescript\n<div class='__elasticAppArtifact__'></div>\n```";
    const expected = "\n<div class='__elasticAppArtifact__'></div>\n";
    expect(stripCodeFenceFromArtifact(input)).toBe(expected);
  });

  it('should not modify content without artifacts', () => {
    const input = '```\nregular code block\n```';
    expect(stripCodeFenceFromArtifact(input)).toBe(input);
  });

  it('should handle empty input', () => {
    expect(stripCodeFenceFromArtifact('')).toBe('');
  });

  it('should handle artifact without code fences', () => {
    const input = "<div class='__elasticAppArtifact__'></div>";
    expect(stripCodeFenceFromArtifact(input)).toBe(input);
  });

  it('should handle multiple artifacts but only remove fences around them', () => {
    const input = [
      'Some text',
      '```typescript',
      "<div class='__elasticAppArtifact__'></div>",
      '```',
      '```',
      'regular code',
      '```',
    ].join('\n');

    const expected = [
      'Some text',
      '',
      "<div class='__elasticAppArtifact__'></div>",
      '',
      '```',
      'regular code',
      '```',
    ].join('\n');

    expect(stripCodeFenceFromArtifact(input)).toBe(expected);
  });
});

const elasticAppArtifact = {
  type: 'elasticApp',
  title: 'Test Artifact',
  filePath: '/test/path',
  actions: [],
};

const elasticAppArtifactWithActions = {
  type: 'elasticApp',
  title: 'Test Artifact',
  filePath: '/test/path',
  actions: [
    {
      type: 'elasticApp',
      title: 'Test Action',
      filePath: '/test/action/path',
    },
  ],
};

describe('Markdown', () => {
  it('should render markdown with elasticApp artifact', () => {
    const { container } = render(<Markdown content="Test content" artifact={elasticAppArtifact} />);
    expect(container).toMatchSnapshot();
  });

  it('should render markdown with elasticApp artifact and actions', () => {
    const { container } = render(<Markdown content="Test content" artifact={elasticAppArtifactWithActions} />);
    expect(container).toMatchSnapshot();
  });
});

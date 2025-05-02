import type { Message } from 'ai';
import { generateId } from './fileUtils';

export interface ProjectCommands {
  type: string;
  setupCommand?: string;
  startCommand?: string;
  followupMessage: string;
}

interface FileContent {
  content: string;
  path: string;
}

export async function detectProjectCommands(files: FileContent[]): Promise<ProjectCommands> {
  const hasFile = (name: string) => files.some((f) => f.path.endsWith(name));

  if (hasFile('package.json')) {
    const packageJsonFile = files.find((f) => f.path.endsWith('package.json'));

    if (!packageJsonFile) {
      return { type: '', setupCommand: '', followupMessage: '' };
    }

    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      const scripts = packageJson?.scripts || {};

      // Check for preferred commands in priority order
      const preferredCommands = ['dev', 'start', 'preview'];
      const availableCommand = preferredCommands.find((cmd) => scripts[cmd]);

      if (availableCommand) {
        return {
          type: 'Node.js',
          setupCommand: `npm install`,
          startCommand: `npm run ${availableCommand}`,
          followupMessage: `Found "${availableCommand}" script in package.json. Running "npm run ${availableCommand}" after installation.`,
        };
      }

      return {
        type: 'Node.js',
        setupCommand: 'npm install',
        followupMessage:
          'Would you like me to inspect package.json to determine the available scripts for running this project?',
      };
    } catch (error) {
      console.error('Error parsing package.json:', error);
      return { type: '', setupCommand: '', followupMessage: '' };
    }
  }

  if (hasFile('index.html')) {
    return {
      type: 'Static',
      startCommand: 'npx --yes serve',
      followupMessage: '',
    };
  }

  return { type: '', setupCommand: '', followupMessage: '' };
}

export function createCommandsMessage(commands: ProjectCommands): Message | null {
  if (!commands.setupCommand && !commands.startCommand) {
    return null;
  }

  let commandString = '';

  if (commands.setupCommand) {
    commandString += `
<elasticAppAction type="shell">${commands.setupCommand}</elasticAppAction>`;
  }

  if (commands.startCommand) {
    commandString += `
<elasticAppAction type="start">${commands.startCommand}</elasticAppAction>
`;
  }

  return {
    role: 'assistant',
    content: `
<elasticAppArtifact id="project-setup" title="Project Setup">
${commandString}
</elasticAppArtifact>${commands.followupMessage ? `\n\n${commands.followupMessage}` : ''}`,
    id: generateId(),
    createdAt: new Date(),
  };
}

export function escapeElasticAppArtifactTags(input: string) {
  return input
    .replace(/<elasticAppArtifact/g, '&lt;elasticAppArtifact')
    .replace(/<\/elasticAppArtifact>/g, '&lt;/elasticAppArtifact&gt;');
}

export function escapeElasticAppActionTags(input: string) {
  return input
    .replace(/<elasticAppAction/g, '&lt;elasticAppAction')
    .replace(/<\/elasticAppAction>/g, '&lt;/elasticAppAction&gt;');
}

export function escapeElasticAppTags(input: string) {
  return escapeElasticAppArtifactTags(escapeElasticAppActionTags(input));
}

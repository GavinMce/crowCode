import { describe, expect, it } from 'vitest';
import { CreateProjectRequestSchema, ProjectSchema } from './project.js';

describe('ProjectSchema', () => {
  it('accepts a fully-formed project', () => {
    const result = ProjectSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'crowcode',
      repoUrl: 'https://github.com/example/repo.git',
      defaultBranch: 'main',
      image: 'crowcode/agent-runtime-base:1',
      agentRoster: [{ name: 'echo-agent', description: 'trivial' }],
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    const result = ProjectSchema.safeParse({
      id: 'not-a-uuid',
      name: 'crowcode',
      repoUrl: 'https://github.com/example/repo.git',
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('defaults defaultBranch to main when omitted', () => {
    const result = ProjectSchema.parse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'crowcode',
      repoUrl: 'https://github.com/example/repo.git',
      createdAt: new Date().toISOString(),
    });
    expect(result.defaultBranch).toBe('main');
    expect(result.agentRoster).toEqual([]);
  });
});

describe('CreateProjectRequestSchema', () => {
  it('rejects a request missing the git credential', () => {
    const result = CreateProjectRequestSchema.safeParse({
      name: 'crowcode',
      repoUrl: 'https://github.com/example/repo.git',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL repoUrl', () => {
    const result = CreateProjectRequestSchema.safeParse({
      name: 'crowcode',
      repoUrl: 'not-a-url',
      gitCredential: 'ghp_example',
    });
    expect(result.success).toBe(false);
  });
});

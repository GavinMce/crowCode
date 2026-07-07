import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { WsRelay } from './ws-relay.js';

/** Minimal WebSocket double: just enough of the `.on`/`.send` surface WsRelay uses. */
class FakeSocket extends EventEmitter {
  sent: unknown[] = [];
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.emit('close');
  }
}

function fakeSocket(): FakeSocket & WebSocket {
  return new FakeSocket() as unknown as FakeSocket & WebSocket;
}

const projectId = '123e4567-e89b-12d3-a456-426614174000';
const otherProjectId = '00000000-0000-0000-0000-000000000000';

describe('WsRelay', () => {
  it('delivers sendToElectron only to sockets subscribed to that project', () => {
    const relay = new WsRelay();
    const subscribed = fakeSocket();
    const otherProject = fakeSocket();
    relay.subscribeElectron(projectId, subscribed);
    relay.subscribeElectron(otherProjectId, otherProject);

    relay.sendToElectron(projectId, { type: 'error', message: 'boom' });

    expect(subscribed.sent).toEqual([{ type: 'error', message: 'boom' }]);
    expect(otherProject.sent).toEqual([]);
  });

  it('stops delivering to an electron socket after it closes', () => {
    const relay = new WsRelay();
    const socket = fakeSocket();
    relay.subscribeElectron(projectId, socket);
    socket.close();

    relay.sendToElectron(projectId, { type: 'error', message: 'after close' });

    expect(socket.sent).toEqual([]);
  });

  it('sendToAgentRuntime returns false when no sandbox is registered for the project', () => {
    const relay = new WsRelay();
    const delivered = relay.sendToAgentRuntime(projectId, { type: 'user_message', text: 'hi' });
    expect(delivered).toBe(false);
  });

  it('routes a user_message from Electron to the registered agent-runtime socket', () => {
    const relay = new WsRelay();
    const runtimeSocket = fakeSocket();
    relay.registerAgentRuntime(projectId, runtimeSocket);

    relay.handleElectronMessage(projectId, { type: 'user_message', projectId, text: 'build the feature' });

    expect(runtimeSocket.sent).toEqual([
      { type: 'user_message', sessionId: undefined, text: 'build the feature' },
    ]);
  });

  it('sends an error back to Electron when no sandbox is running for the project', () => {
    const relay = new WsRelay();
    const electronSocket = fakeSocket();
    relay.subscribeElectron(projectId, electronSocket);

    relay.handleElectronMessage(projectId, { type: 'user_message', projectId, text: 'hi' });

    expect(electronSocket.sent).toEqual([
      { type: 'error', message: `No running sandbox for project ${projectId}` },
    ]);
  });

  it('relays a session_event from agent-runtime to subscribed Electron sockets', () => {
    const relay = new WsRelay();
    const electronSocket = fakeSocket();
    relay.subscribeElectron(projectId, electronSocket);

    const event = {
      projectId,
      sessionId: 'sdk-session-1',
      timestamp: new Date().toISOString(),
      payload: { type: 'memory_flushed' as const, key: 'memory/MEMORY.md' },
    };
    relay.handleAgentRuntimeMessage(projectId, { type: 'session_event', event });

    expect(electronSocket.sent).toEqual([{ type: 'session_event', event }]);
  });
});

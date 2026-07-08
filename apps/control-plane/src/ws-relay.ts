import type { WebSocket } from 'ws';
import type {
  AgentRuntimeToControlPlaneMessage,
  ControlPlaneToAgentRuntimeMessage,
  ControlPlaneToElectronMessage,
  ElectronToControlPlaneMessage,
} from '@crowcode/shared-types';

/**
 * In-memory relay keyed by projectId. Agent-runtime dials out to us (one
 * socket per running sandbox); any number of Electron clients can subscribe
 * to the same project. Swap for Redis pub/sub only if control-plane needs to
 * run as more than one instance -- not needed for v1.
 */
export class WsRelay {
  private readonly electronSockets = new Map<string, Set<WebSocket>>();
  private readonly runtimeSockets = new Map<string, WebSocket>();

  subscribeElectron(projectId: string, socket: WebSocket): void {
    const set = this.electronSockets.get(projectId) ?? new Set();
    set.add(socket);
    this.electronSockets.set(projectId, set);
    socket.on('close', () => set.delete(socket));
  }

  registerAgentRuntime(projectId: string, socket: WebSocket): void {
    this.runtimeSockets.set(projectId, socket);
    socket.on('close', () => {
      if (this.runtimeSockets.get(projectId) === socket) this.runtimeSockets.delete(projectId);
    });
  }

  sendToElectron(projectId: string, message: ControlPlaneToElectronMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.electronSockets.get(projectId) ?? []) {
      socket.send(payload);
    }
  }

  sendToAgentRuntime(projectId: string, message: ControlPlaneToAgentRuntimeMessage): boolean {
    const socket = this.runtimeSockets.get(projectId);
    if (!socket) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  handleElectronMessage(projectId: string, message: ElectronToControlPlaneMessage): void {
    if (message.type === 'user_message') {
      const delivered = this.sendToAgentRuntime(projectId, {
        type: 'user_message',
        sessionId: message.sessionId,
        text: message.text,
      });
      if (!delivered) {
        this.sendToElectron(projectId, {
          type: 'error',
          message: `No running sandbox for project ${projectId}`,
        });
      }
    }
  }

  handleAgentRuntimeMessage(projectId: string, message: AgentRuntimeToControlPlaneMessage): void {
    if (message.type === 'session_event') {
      this.sendToElectron(projectId, { type: 'session_event', event: message.event });
    } else if (message.type === 'error') {
      this.sendToElectron(projectId, { type: 'error', message: message.message });
    }
  }
}

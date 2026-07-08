import type { WebSocket } from 'ws';
import type {
  AgentRuntimeToControlPlaneMessage,
  ControlPlaneToAgentRuntimeMessage,
  ControlPlaneToElectronMessage,
  ElectronToControlPlaneMessage,
} from '@crowcode/shared-types';

/**
 * In-memory relay. Two independent scopes:
 * - Session-scoped (keyed by crowCode sessionId): one sandbox container per
 *   session, any number of Electron clients subscribed to that session's
 *   chat. This is the original/primary scope.
 * - Project-scoped (keyed by projectId): for state that outlives any one
 *   session's container -- currently just managed-agent live status, since
 *   an agent's persistent conversation isn't tied to any single session.
 * Swap for Redis pub/sub only if control-plane needs to run as more than
 * one instance -- not needed for v1.
 */
export class WsRelay {
  private readonly electronSockets = new Map<string, Set<WebSocket>>();
  private readonly runtimeSockets = new Map<string, WebSocket>();
  private readonly projectSockets = new Map<string, Set<WebSocket>>();

  subscribeElectron(sessionId: string, socket: WebSocket): void {
    const set = this.electronSockets.get(sessionId) ?? new Set();
    set.add(socket);
    this.electronSockets.set(sessionId, set);
    socket.on('close', () => set.delete(socket));
  }

  subscribeProject(projectId: string, socket: WebSocket): void {
    const set = this.projectSockets.get(projectId) ?? new Set();
    set.add(socket);
    this.projectSockets.set(projectId, set);
    socket.on('close', () => set.delete(socket));
  }

  registerAgentRuntime(sessionId: string, socket: WebSocket): void {
    this.runtimeSockets.set(sessionId, socket);
    socket.on('close', () => {
      if (this.runtimeSockets.get(sessionId) === socket) this.runtimeSockets.delete(sessionId);
    });
  }

  sendToElectron(sessionId: string, message: ControlPlaneToElectronMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.electronSockets.get(sessionId) ?? []) {
      socket.send(payload);
    }
  }

  broadcastToProject(projectId: string, message: ControlPlaneToElectronMessage): void {
    const payload = JSON.stringify(message);
    for (const socket of this.projectSockets.get(projectId) ?? []) {
      socket.send(payload);
    }
  }

  sendToAgentRuntime(sessionId: string, message: ControlPlaneToAgentRuntimeMessage): boolean {
    const socket = this.runtimeSockets.get(sessionId);
    if (!socket) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  handleElectronMessage(sessionId: string, message: ElectronToControlPlaneMessage): void {
    if (message.type === 'user_message') {
      const delivered = this.sendToAgentRuntime(sessionId, {
        type: 'user_message',
        text: message.text,
      });
      if (!delivered) {
        this.sendToElectron(sessionId, {
          type: 'error',
          message: `No running sandbox for session ${sessionId}`,
        });
      }
    }
  }

  handleAgentRuntimeMessage(sessionId: string, message: AgentRuntimeToControlPlaneMessage): void {
    if (message.type === 'session_event') {
      this.sendToElectron(sessionId, { type: 'session_event', event: message.event });
    } else if (message.type === 'error') {
      this.sendToElectron(sessionId, { type: 'error', message: message.message });
    } else if (message.type === 'agent_status') {
      this.broadcastToProject(message.projectId, {
        type: 'agent_status',
        projectId: message.projectId,
        agentId: message.agentId,
        status: message.status,
      });
    }
  }
}

import { useState } from 'react';
import type { CrowcodeConfig } from '../global.js';

export function AppSettings({
  config,
  onSave,
  onClose,
}: {
  config: CrowcodeConfig;
  onSave: (config: CrowcodeConfig) => void;
  onClose: () => void;
}) {
  const [httpUrl, setHttpUrl] = useState(config.controlPlaneHttpUrl);
  const [wsUrl, setWsUrl] = useState(config.controlPlaneWsUrl);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!httpUrl.trim() || !wsUrl.trim() || saving) return;
    setSaving(true);
    const updated = await window.crowcode.setConfig({
      controlPlaneHttpUrl: httpUrl.trim(),
      controlPlaneWsUrl: wsUrl.trim(),
    });
    setSaving(false);
    onSave(updated);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <h4 className="settings-section-title">Control plane connection</h4>
          <p className="settings-section-hint">
            Where this app connects to for projects, sessions, and agents. Point it at a remote or cloud-hosted
            control-plane instead of a local one running on this machine.
          </p>

          <div className="agent-form">
            <label className="settings-field-label" htmlFor="app-settings-http">
              HTTP URL
            </label>
            <input
              id="app-settings-http"
              className="sidebar-input"
              value={httpUrl}
              onChange={(e) => setHttpUrl(e.target.value)}
              placeholder="http://localhost:8787"
            />
            <label className="settings-field-label" htmlFor="app-settings-ws">
              WebSocket URL
            </label>
            <input
              id="app-settings-ws"
              className="sidebar-input"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="ws://localhost:8787/ws/electron"
            />
            <div className="new-project-form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

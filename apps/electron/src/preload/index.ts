import { contextBridge, ipcRenderer } from 'electron';

export interface CrowcodeConfig {
  controlPlaneHttpUrl: string;
  controlPlaneWsUrl: string;
}

const api = {
  getConfig: (): Promise<CrowcodeConfig> => ipcRenderer.invoke('crowcode:get-config'),
};

contextBridge.exposeInMainWorld('crowcode', api);

export type CrowcodeApi = typeof api;

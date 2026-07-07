export interface CrowcodeConfig {
  controlPlaneHttpUrl: string;
  controlPlaneWsUrl: string;
}

declare global {
  interface Window {
    crowcode: {
      getConfig: () => Promise<CrowcodeConfig>;
    };
  }
}

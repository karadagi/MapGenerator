declare module 'dat.gui' {
  export class GUI {
    constructor(params?: any);
    addFolder(name: string): GUI;
    add(target: any, propName: string, ...params: any[]): any;
    addColor(target: any, propName: string): any;
    removeFolder(folder: GUI): void;
    destroy(): void;

    // ✅ Add missing members used by your code
    close(): void;
    closed: boolean;
  }

  // default export
  const dat: { GUI: typeof GUI };
  export default dat;
}

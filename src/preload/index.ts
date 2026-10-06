import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/ipc'
const desktop: DesktopApi = {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke('desktop:minimize', null),
  toggleMaximize: () => ipcRenderer.invoke('desktop:toggleMaximize', null),
  close: () => ipcRenderer.invoke('desktop:close', null),
  openExternal: (url) => ipcRenderer.invoke('desktop:openExternal', url),
  exportJson: (json) => ipcRenderer.invoke('desktop:exportJson', json),
}
contextBridge.exposeInMainWorld('desktop', desktop)

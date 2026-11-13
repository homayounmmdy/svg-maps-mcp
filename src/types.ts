export interface MapInfo {
  id: string;
  name: string;
  code: string;
  regions: number;
  supportsLabels: boolean;
}

export interface MapCatalogPayload {
  total: number;
  maps: MapInfo[];
}
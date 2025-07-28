// Type definitions for Leaflet extensions and custom implementations

declare module 'leaflet.heat' {
  import * as L from 'leaflet';
  
  export interface HeatLatLngTuple extends Array<number> {
    0: number; // latitude
    1: number; // longitude
    2?: number; // intensity
  }
  
  export interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: number]: string };
  }
  
  export interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: HeatLatLngTuple[]): this;
    addLatLng(latlng: HeatLatLngTuple): this;
    setOptions(options: HeatMapOptions): this;
    redraw(): this;
  }
  
  export function heatLayer(
    latlngs?: HeatLatLngTuple[],
    options?: HeatMapOptions
  ): HeatLayer;
}

declare module 'leaflet.markercluster' {
  import * as L from 'leaflet';
  
  export interface MarkerClusterGroupOptions extends L.LayerOptions {
    maxClusterRadius?: number | ((zoom: number) => number);
    clusterPane?: string;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    singleMarkerMode?: boolean;
    disableClusteringAtZoom?: number;
    removeOutsideVisibleBounds?: boolean;
    animate?: boolean;
    animateAddingMarkers?: boolean;
    spiderfyDistanceMultiplier?: number;
    spiderLegPolylineOptions?: L.PolylineOptions;
    chunkedLoading?: boolean;
    chunkInterval?: number;
    chunkDelay?: number;
    chunkProgress?: (processed: number, total: number, elapsed: number) => void;
    polygonOptions?: L.PolylineOptions;
    iconCreateFunction?: (cluster: MarkerCluster) => L.Icon;
  }
  
  export interface MarkerCluster extends L.Marker {
    getChildCount(): number;
    getAllChildMarkers(): L.Marker[];
    spiderfy(): void;
    unspiderfy(): void;
  }
  
  export class MarkerClusterGroup extends L.FeatureGroup {
    constructor(options?: MarkerClusterGroupOptions);
    addLayer(layer: L.Layer): this;
    removeLayer(layer: L.Layer): this;
    addLayers(layers: L.Layer[]): this;
    removeLayers(layers: L.Layer[]): this;
    clearLayers(): this;
    getVisibleParent(marker: L.Marker): MarkerCluster | null;
    refreshClusters(clusters?: MarkerCluster | MarkerCluster[]): this;
    getChildCount(): number;
    getAllChildMarkers(): L.Marker[];
    hasLayer(layer: L.Layer): boolean;
    zoomToShowLayer(layer: L.Layer, callback?: () => void): this;
  }
  
  export function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}

// Extend Leaflet namespace 
declare module 'leaflet' {
  // Ensure Map class is available for import
  export class Map {
    constructor(element: string | HTMLElement, options?: any);
    addLayer(layer: any): this;
    removeLayer(layer: any): this;
    remove(): this;
    getBounds(): any;
    setView(center: [number, number], zoom: number): this;
    getZoom(): number;
    on(type: string, fn: Function): this;
    off(type: string, fn?: Function): this;
  }
  
  // Add missing factory functions
  export function map(element: string | HTMLElement, options?: any): Map;
  export function tileLayer(urlTemplate: string, options?: any): any;
  export function marker(latlng: [number, number], options?: any): any;
  export function polyline(latlngs: [number, number][], options?: any): any;
  export function circleMarker(latlng: [number, number], options?: any): any;
  
  // Add control namespace
  export namespace control {
    export function layers(baseLayers?: any, overlays?: any, options?: any): any;
    export function scale(options?: any): any;
  }
  
  export interface Icon {
    options: IconOptions;
  }
  
  export interface IconOptions {
    iconUrl?: string;
    iconRetinaUrl?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
    tooltipAnchor?: [number, number];
    shadowUrl?: string;
    shadowRetinaUrl?: string;
    shadowSize?: [number, number];
    shadowAnchor?: [number, number];
    className?: string;
  }

  export interface DivIconOptions {
    html?: string | HTMLElement;
    bgPos?: [number, number];
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
    className?: string;
  }

  export interface DivIcon extends Icon {
    options: DivIconOptions;
  }

  export function divIcon(options?: DivIconOptions): DivIcon;

  // Extend event handling types
  export interface LeafletMouseEvent extends Event {
    latlng: LatLng;
    layerPoint: Point;
    containerPoint: Point;
    originalEvent: MouseEvent;
    target: any;
    sourceTarget: any;
    propagatedFrom: any;
  }

  export interface LeafletEvent extends Event {
    target: any;
    sourceTarget: any;
    propagatedFrom: any;
    layer?: Layer;
  }

  // Extend Marker interface with proper event handling
  export interface Marker {
    on(type: 'click' | 'dblclick', fn: (e: LeafletMouseEvent) => void, context?: any): this;
    on(type: string, fn: (e: LeafletEvent) => void, context?: any): this;
  }
}
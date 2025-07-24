export interface ImageLayout {
  name: string;
  width: number;
  height: number;
  positions: ImagePosition[];
}

export interface ImagePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComposedImage {
  path: string;
  url: string;
  layout: string;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface ImageTemplate {
  id: string;
  name: string;
  backgroundColor: string;
  elements: TemplateElement[];
}

export interface TemplateElement {
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  font?: string;
  color?: string;
  shape?: 'circle' | 'rect';
  radius?: number;
}
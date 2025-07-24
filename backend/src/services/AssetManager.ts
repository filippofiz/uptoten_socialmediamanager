import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { supabase } from '../lib/supabase';

interface UploadedAsset {
  id: string;
  filename: string;
  type: 'logo' | 'background' | 'template' | 'overlay';
  url: string;
  dimensions: { width: number; height: number };
  created_at: string;
}

export class AssetManager {
  private assetsDir: string;
  private allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

  constructor() {
    this.assetsDir = path.join(process.cwd(), 'public', 'assets');
    this.ensureAssetsDirectory();
  }

  private async ensureAssetsDirectory() {
    try {
      await fs.mkdir(this.assetsDir, { recursive: true });
      await fs.mkdir(path.join(this.assetsDir, 'logos'), { recursive: true });
      await fs.mkdir(path.join(this.assetsDir, 'backgrounds'), { recursive: true });
      await fs.mkdir(path.join(this.assetsDir, 'templates'), { recursive: true });
      await fs.mkdir(path.join(this.assetsDir, 'overlays'), { recursive: true });
    } catch (error) {
      console.error('Error creating assets directories:', error);
    }
  }

  async uploadAsset(
    file: Buffer, 
    originalName: string, 
    mimeType: string, 
    type: 'logo' | 'background' | 'template' | 'overlay'
  ): Promise<UploadedAsset> {
    
    if (!this.allowedTypes.includes(mimeType)) {
      throw new Error('Tipo file non supportato. Usa JPG, PNG, WebP o SVG');
    }

    const fileExtension = this.getFileExtension(mimeType);
    const filename = `${Date.now()}_${this.sanitizeFilename(originalName)}.${fileExtension}`;
    const filepath = path.join(this.assetsDir, type + 's', filename);

    // Processa l'immagine con Sharp (tranne SVG)
    if (mimeType !== 'image/svg+xml') {
      const processedImage = await this.processImage(file, type);
      await fs.writeFile(filepath, processedImage.buffer);
      
      const asset: UploadedAsset = {
        id: `${type}_${Date.now()}`,
        filename,
        type,
        url: `/assets/${type}s/${filename}`,
        dimensions: processedImage.dimensions,
        created_at: new Date().toISOString()
      };

      // Salva nel database
      await this.saveAssetToDatabase(asset);
      return asset;
      
    } else {
      // SVG non processato
      await fs.writeFile(filepath, file);
      
      const asset: UploadedAsset = {
        id: `${type}_${Date.now()}`,
        filename,
        type,
        url: `/assets/${type}s/${filename}`,
        dimensions: { width: 0, height: 0 }, // SVG è vettoriale
        created_at: new Date().toISOString()
      };

      await this.saveAssetToDatabase(asset);
      return asset;
    }
  }

  private async processImage(buffer: Buffer, type: string): Promise<{
    buffer: Buffer;
    dimensions: { width: number; height: number };
  }> {
    let image = sharp(buffer);
    
    // Ottimizzazioni specifiche per tipo
    switch (type) {
      case 'logo':
        // Logo: massimo 400x400, mantieni trasparenza
        image = image.resize(400, 400, { 
          fit: 'inside',
          withoutEnlargement: true 
        });
        break;
        
      case 'background':
        // Background: 1920x1080 per coprire tutti i social
        image = image.resize(1920, 1080, { 
          fit: 'cover' 
        });
        break;
        
      case 'template':
        // Template: 1080x1080 (Instagram standard)
        image = image.resize(1080, 1080, { 
          fit: 'cover' 
        });
        break;
        
      case 'overlay':
        // Overlay: mantieni dimensioni originali, aggiungi trasparenza
        break;
    }

    // Converti in PNG per mantenere trasparenza se necessario
    const processedBuffer = await image.png({ quality: 90 }).toBuffer();
    const metadata = await sharp(processedBuffer).metadata();
    
    return {
      buffer: processedBuffer,
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0
      }
    };
  }

  async integrateAssetIntoGeneratedImage(
    generatedImagePath: string,
    assetId: string,
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'background',
    scale: number = 1
  ): Promise<string> {
    
    const asset = await this.getAssetById(assetId);
    if (!asset) throw new Error('Asset non trovato');

    const assetPath = path.join(process.cwd(), 'public', asset.url.substring(1));
    const outputPath = generatedImagePath.replace('.png', '_branded.png');

    const baseImage = sharp(generatedImagePath);
    const assetImage = sharp(assetPath);
    
    const baseMetadata = await baseImage.metadata();
    const assetMetadata = await assetImage.metadata();

    if (position === 'background') {
      // Usa l'asset come background
      const resizedAsset = await assetImage
        .resize(baseMetadata.width, baseMetadata.height, { fit: 'cover' })
        .toBuffer();
        
      const composite = await sharp(resizedAsset)
        .composite([{ 
          input: await baseImage.toBuffer(),
          blend: 'overlay' 
        }])
        .toFile(outputPath);
        
      return outputPath;
    }

    // Calcola posizione overlay
    const scaledWidth = Math.round((assetMetadata.width || 100) * scale);
    const scaledHeight = Math.round((assetMetadata.height || 100) * scale);
    
    const positions = this.calculateOverlayPosition(
      position,
      baseMetadata.width || 1080,
      baseMetadata.height || 1080,
      scaledWidth,
      scaledHeight
    );

    // Ridimensiona asset
    const resizedAsset = await assetImage
      .resize(scaledWidth, scaledHeight)
      .toBuffer();

    // Applica composite
    await baseImage
      .composite([{
        input: resizedAsset,
        top: positions.top,
        left: positions.left
      }])
      .toFile(outputPath);

    return outputPath;
  }

  private calculateOverlayPosition(
    position: string,
    baseWidth: number,
    baseHeight: number,
    assetWidth: number,
    assetHeight: number
  ): { top: number; left: number } {
    
    const margin = 40; // Margine dai bordi
    
    switch (position) {
      case 'top-left':
        return { top: margin, left: margin };
        
      case 'top-right':
        return { top: margin, left: baseWidth - assetWidth - margin };
        
      case 'bottom-left':
        return { top: baseHeight - assetHeight - margin, left: margin };
        
      case 'bottom-right':
        return { 
          top: baseHeight - assetHeight - margin, 
          left: baseWidth - assetWidth - margin 
        };
        
      case 'center':
        return { 
          top: Math.round((baseHeight - assetHeight) / 2), 
          left: Math.round((baseWidth - assetWidth) / 2) 
        };
        
      default:
        return { top: margin, left: margin };
    }
  }

  async createBrandTemplate(
    backgroundColor: string = '#ffffff',
    logoAssetId?: string,
    backgroundAssetId?: string
  ): Promise<string> {
    
    const canvas = sharp({
      create: {
        width: 1080,
        height: 1080,
        channels: 4,
        background: backgroundColor
      }
    });

    const composites = [];

    // Aggiungi background personalizzato se specificato
    if (backgroundAssetId) {
      const bgAsset = await this.getAssetById(backgroundAssetId);
      if (bgAsset) {
        const bgPath = path.join(process.cwd(), 'public', bgAsset.url.substring(1));
        const resizedBg = await sharp(bgPath)
          .resize(1080, 1080, { fit: 'cover' })
          .toBuffer();
        
        composites.push({
          input: resizedBg,
          blend: 'multiply' as const
        });
      }
    }

    // Aggiungi logo se specificato
    if (logoAssetId) {
      const logoAsset = await this.getAssetById(logoAssetId);
      if (logoAsset) {
        const logoPath = path.join(process.cwd(), 'public', logoAsset.url.substring(1));
        const resizedLogo = await sharp(logoPath)
          .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        
        composites.push({
          input: resizedLogo,
          top: 40,
          left: 40
        });
      }
    }

    const filename = `template_brand_${Date.now()}.png`;
    const outputPath = path.join(this.assetsDir, 'templates', filename);
    
    await canvas.composite(composites).png().toFile(outputPath);
    
    return outputPath;
  }

  private async saveAssetToDatabase(asset: UploadedAsset) {
    const { error } = await supabase
      .from('uploaded_assets')
      .insert({
        asset_id: asset.id,
        filename: asset.filename,
        type: asset.type,
        url: asset.url,
        dimensions: asset.dimensions,
        created_at: asset.created_at
      });

    if (error) {
      console.error('Error saving asset to database:', error);
    }
  }

  async getAssetById(id: string): Promise<UploadedAsset | null> {
    const { data, error } = await supabase
      .from('uploaded_assets')
      .select('*')
      .eq('asset_id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.asset_id,
      filename: data.filename,
      type: data.type,
      url: data.url,
      dimensions: data.dimensions,
      created_at: data.created_at
    };
  }

  async getAssetsByType(type: string): Promise<UploadedAsset[]> {
    const { data, error } = await supabase
      .from('uploaded_assets')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(item => ({
      id: item.asset_id,
      filename: item.filename,
      type: item.type,
      url: item.url,
      dimensions: item.dimensions,
      created_at: item.created_at
    }));
  }

  async deleteAsset(id: string): Promise<boolean> {
    const asset = await this.getAssetById(id);
    if (!asset) return false;

    try {
      // Rimuovi file dal filesystem
      const filepath = path.join(process.cwd(), 'public', asset.url.substring(1));
      await fs.unlink(filepath);

      // Rimuovi dal database
      const { error } = await supabase
        .from('uploaded_assets')
        .delete()
        .eq('asset_id', id);

      return !error;
    } catch (error) {
      console.error('Error deleting asset:', error);
      return false;
    }
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };
    return extensions[mimeType] || 'png';
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  // Metodi di utilità per il frontend
  async getAssetLibrary(): Promise<{
    logos: UploadedAsset[];
    backgrounds: UploadedAsset[];
    templates: UploadedAsset[];
    overlays: UploadedAsset[];
  }> {
    const [logos, backgrounds, templates, overlays] = await Promise.all([
      this.getAssetsByType('logo'),
      this.getAssetsByType('background'),
      this.getAssetsByType('template'),
      this.getAssetsByType('overlay')
    ]);

    return { logos, backgrounds, templates, overlays };
  }
}
import sharp from 'sharp';
import Jimp from 'jimp';
import axios from 'axios';
import { ImageLayout, ComposedImage } from '../types/image';
import fs from 'fs/promises';
import path from 'path';

export class ImageComposer {
  private layoutTemplates: Map<string, ImageLayout> = new Map();
  private outputDir: string;
  private brandAssetsDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'public', 'composed-images');
    this.brandAssetsDir = path.join(process.cwd(), 'public', 'brand-assets');
    this.initializeLayouts();
    this.ensureOutputDirectory();
    this.ensureBrandAssetsDirectory();
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
  }

  private async ensureBrandAssetsDirectory() {
    try {
      await fs.mkdir(this.brandAssetsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating brand assets directory:', error);
    }
  }

  private initializeLayouts() {
    this.layoutTemplates = new Map([
      ['single', {
        name: 'single',
        width: 1080,
        height: 1080,
        positions: [{ x: 0, y: 0, width: 1080, height: 1080 }]
      }],
      ['grid-2x2', {
        name: 'grid-2x2',
        width: 1080,
        height: 1080,
        positions: [
          { x: 0, y: 0, width: 540, height: 540 },
          { x: 540, y: 0, width: 540, height: 540 },
          { x: 0, y: 540, width: 540, height: 540 },
          { x: 540, y: 540, width: 540, height: 540 }
        ]
      }],
      ['collage-3', {
        name: 'collage-3',
        width: 1080,
        height: 1080,
        positions: [
          { x: 0, y: 0, width: 720, height: 720 },
          { x: 720, y: 0, width: 360, height: 360 },
          { x: 720, y: 360, width: 360, height: 360 }
        ]
      }],
      ['story', {
        name: 'story',
        width: 1080,
        height: 1920,
        positions: [{ x: 0, y: 0, width: 1080, height: 1920 }]
      }],
      ['carousel', {
        name: 'carousel',
        width: 1080,
        height: 1080,
        positions: [{ x: 0, y: 0, width: 1080, height: 1080 }]
      }]
    ]);
  }

  async createTextImage(options: {
    text: string;
    template?: string;
    backgroundColor?: string;
    textColor?: string;
    width?: number;
    height?: number;
  }): Promise<string> {
    const {
      text,
      backgroundColor = '#1a73e8',
      textColor = '#ffffff',
      width = 1080,
      height = 1080
    } = options;

    const image = await Jimp.create(width, height, backgroundColor);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    
    // Add text to image
    image.print(
      font,
      0,
      0,
      {
        text: text,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      width,
      height
    );

    const outputPath = path.join(this.outputDir, `text_${Date.now()}.png`);
    await image.writeAsync(outputPath);
    
    return outputPath;
  }

  async composeImages(imageUrls: string[], layoutName: string = 'single'): Promise<ComposedImage> {
    const layout = this.layoutTemplates.get(layoutName) || this.layoutTemplates.get('single')!;
    
    const backgroundBuffer = await sharp({
      create: {
        width: layout.width,
        height: layout.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

    const compositeImages = [];
    const images = await Promise.all(
      imageUrls.slice(0, layout.positions.length).map(url => this.downloadImage(url))
    );

    for (let i = 0; i < images.length && i < layout.positions.length; i++) {
      const pos = layout.positions[i];
      if (!pos) continue;
      
      const resizedImage = await sharp(images[i])
        .resize(pos.width, pos.height, { fit: 'cover' })
        .toBuffer();
      
      compositeImages.push({
        input: resizedImage,
        top: pos.y,
        left: pos.x
      });
    }

    const filename = `composed_${Date.now()}.png`;
    const filepath = path.join(this.outputDir, filename);
    
    await sharp(backgroundBuffer)
      .composite(compositeImages)
      .toFile(filepath);

    return {
      path: filepath,
      url: `/composed-images/${filename}`,
      layout: layout.name,
      dimensions: { width: layout.width, height: layout.height }
    };
  }

  async addTextOverlay(imagePath: string, text: string): Promise<string> {
    const image = await Jimp.read(imagePath);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    
    const { width, height } = image.bitmap;
    
    image.scan(0, height - 200, width, 200, function(x, y, idx) {
      this.bitmap.data[idx + 0] = 0;
      this.bitmap.data[idx + 1] = 0;
      this.bitmap.data[idx + 2] = 0;
      this.bitmap.data[idx + 3] = 180;
    });
    
    image.print(
      font,
      0,
      height - 150,
      {
        text: text,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      },
      width,
      150
    );

    const outputPath = imagePath.replace('.png', '_text.png');
    await image.writeAsync(outputPath);
    
    return outputPath;
  }

  async addBranding(imagePath: string, brandLogo?: string): Promise<string> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    const compositeImages = [];
    
    if (brandLogo) {
      compositeImages.push({
        input: await sharp(brandLogo)
          .resize(100, 100)
          .toBuffer(),
        top: metadata.height! - 120,
        left: metadata.width! - 120
      });
    }

    const watermark = Buffer.from(
      `<svg width="200" height="30">
        <text x="0" y="20" font-family="Arial" font-size="16" fill="white" opacity="0.7">
          ${new Date().toLocaleDateString()}
        </text>
      </svg>`
    );
    
    compositeImages.push({
      input: watermark,
      top: metadata.height! - 40,
      left: 20
    });

    const outputPath = imagePath.replace('.png', '_branded.png');
    await image
      .composite(compositeImages)
      .toFile(outputPath);
    
    return outputPath;
  }

  async createTemplate(templateName: string, backgroundColor: string): Promise<string> {
    const canvas = await sharp({
      create: {
        width: 1080,
        height: 1080,
        channels: 4,
        background: backgroundColor
      }
    }).png().toBuffer();
    
    const filename = `template_${templateName}_${Date.now()}.png`;
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, canvas);
    
    return filepath;
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async optimizeForPlatform(imagePath: string, platform: string): Promise<string> {
    const image = sharp(imagePath);
    let outputPath = imagePath;
    
    switch (platform) {
      case 'instagram':
        outputPath = imagePath.replace('.png', '_instagram.jpg');
        await image
          .resize(1080, 1080, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toFile(outputPath);
        break;
      
      case 'twitter':
        outputPath = imagePath.replace('.png', '_twitter.jpg');
        await image
          .resize(1200, 675, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toFile(outputPath);
        break;
      
      case 'facebook':
        outputPath = imagePath.replace('.png', '_facebook.jpg');
        await image
          .resize(1200, 630, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toFile(outputPath);
        break;
      
      case 'story':
        outputPath = imagePath.replace('.png', '_story.jpg');
        await image
          .resize(1080, 1920, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toFile(outputPath);
        break;
    }
    
    return outputPath;
  }

  async saveBrandLogo(logoBuffer: Buffer, filename: string): Promise<string> {
    const logoPath = path.join(this.brandAssetsDir, `logo_${filename}`);
    await fs.writeFile(logoPath, logoBuffer);
    return logoPath;
  }

  async saveBrandBackground(backgroundBuffer: Buffer, filename: string): Promise<string> {
    const bgPath = path.join(this.brandAssetsDir, `bg_${filename}`);
    await fs.writeFile(bgPath, backgroundBuffer);
    return bgPath;
  }

  async composeWithBrandAssets(
    aiImageUrl: string,
    options: {
      platform?: string;
      logoPath?: string;
      backgroundPath?: string;
      templatePath?: string;
      logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
      logoSize?: number;
      overlayOpacity?: number;
      supabase?: any;
    } = {}
  ): Promise<string> {
    const {
      platform,
      logoPath,
      backgroundPath,
      templatePath,
      logoPosition = 'bottom-right',
      logoSize = 150,
      overlayOpacity = 0.9,
      supabase
    } = options;

    // Download AI-generated image
    const aiImageBuffer = await this.downloadImage(aiImageUrl);
    const timestamp = Date.now();
    let composedImagePath = path.join(this.outputDir, `branded_${timestamp}.png`);

    // Fetch assets from Supabase if provided
    let logoBuffer: Buffer | undefined;
    let backgroundBuffer: Buffer | undefined;
    
    if (supabase) {
      // Fetch logo from Supabase
      if (logoPath) {
        const { data: logoAsset } = await supabase
          .from('brand_assets')
          .select('file_url')
          .eq('id', logoPath)
          .single();
        
        if (logoAsset?.file_url) {
          // Extract base64 data from data URL
          const base64Data = logoAsset.file_url.split(',')[1];
          logoBuffer = Buffer.from(base64Data, 'base64');
        }
      }
      
      // Fetch background/template from Supabase
      if (backgroundPath || templatePath) {
        const assetId = backgroundPath || templatePath;
        const { data: bgAsset } = await supabase
          .from('brand_assets')
          .select('file_url')
          .eq('id', assetId)
          .single();
        
        if (bgAsset?.file_url) {
          // Extract base64 data from data URL
          const base64Data = bgAsset.file_url.split(',')[1];
          backgroundBuffer = Buffer.from(base64Data, 'base64');
        }
      }
    } else {
      // Use file paths directly if no Supabase
      if (logoPath && await this.fileExists(logoPath)) {
        logoBuffer = await fs.readFile(logoPath);
      }
      if (backgroundPath && await this.fileExists(backgroundPath)) {
        backgroundBuffer = await fs.readFile(backgroundPath);
      }
    }

    // Start with background or AI image
    let baseImage: sharp.Sharp;
    if (backgroundBuffer) {
      // Use brand background as base
      baseImage = sharp(backgroundBuffer);
      const bgMetadata = await baseImage.metadata();
      
      // Overlay AI image with opacity
      const aiImageResized = await sharp(aiImageBuffer)
        .resize(Math.floor(bgMetadata.width! * 0.8), Math.floor(bgMetadata.height! * 0.8), { fit: 'inside' })
        .composite([{
          input: Buffer.from(
            `<svg width="${Math.floor(bgMetadata.width! * 0.8)}" height="${Math.floor(bgMetadata.height! * 0.8)}">
              <rect width="100%" height="100%" fill="white" opacity="${overlayOpacity}"/>
            </svg>`
          ),
          blend: 'dest-in'
        }])
        .toBuffer();

      baseImage = await baseImage.composite([{
        input: aiImageResized,
        gravity: 'center'
      }]);
    } else {
      // Use AI image as base
      baseImage = sharp(aiImageBuffer);
    }

    const metadata = await baseImage.metadata();
    const compositeImages = [];

    // Add logo if provided
    if (logoBuffer) {
      const resizedLogoBuffer = await sharp(logoBuffer)
        .resize(logoSize, logoSize, { fit: 'inside' })
        .toBuffer();

      let logoTop = 20;
      let logoLeft = 20;

      switch (logoPosition) {
        case 'top-right':
          logoLeft = metadata.width! - logoSize - 20;
          break;
        case 'bottom-left':
          logoTop = metadata.height! - logoSize - 20;
          break;
        case 'bottom-right':
          logoTop = metadata.height! - logoSize - 20;
          logoLeft = metadata.width! - logoSize - 20;
          break;
        case 'center':
          logoTop = (metadata.height! - logoSize) / 2;
          logoLeft = (metadata.width! - logoSize) / 2;
          break;
      }

      compositeImages.push({
        input: resizedLogoBuffer,
        top: logoTop,
        left: logoLeft
      });
    }

    // Save the composed image
    await baseImage
      .composite(compositeImages)
      .toFile(composedImagePath);

    return composedImagePath;
  }

  async createBrandedVariations(
    aiImageUrl: string,
    brandAssets: {
      logoPath?: string;
      backgroundPaths?: string[];
    }
  ): Promise<string[]> {
    const variations: string[] = [];

    // Original AI image
    const timestamp = Date.now();
    const originalPath = path.join(this.outputDir, `original_${timestamp}.png`);
    const imageBuffer = await this.downloadImage(aiImageUrl);
    await fs.writeFile(originalPath, imageBuffer);
    variations.push(originalPath);

    // With logo only
    if (brandAssets.logoPath) {
      const withLogo = await this.composeWithBrandAssets(aiImageUrl, {
        logoPath: brandAssets.logoPath,
        logoPosition: 'bottom-right'
      });
      variations.push(withLogo);
    }

    // With different backgrounds
    if (brandAssets.backgroundPaths && brandAssets.backgroundPaths.length > 0) {
      for (let i = 0; i < Math.min(brandAssets.backgroundPaths.length, 3); i++) {
        const withBg = await this.composeWithBrandAssets(aiImageUrl, {
          logoPath: brandAssets.logoPath,
          backgroundPath: brandAssets.backgroundPaths[i],
          logoPosition: 'bottom-right'
        });
        variations.push(withBg);
      }
    }

    return variations;
  }
}
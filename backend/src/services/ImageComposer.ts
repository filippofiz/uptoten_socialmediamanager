import sharp from 'sharp';
import Jimp from 'jimp';
import axios from 'axios';
import { ImageLayout, ComposedImage } from '../types/image';
import fs from 'fs/promises';
import path from 'path';

export class ImageComposer {
  private layoutTemplates: Map<string, ImageLayout> = new Map();
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'public', 'composed-images');
    this.initializeLayouts();
    this.ensureOutputDirectory();
  }

  private async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating output directory:', error);
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
}
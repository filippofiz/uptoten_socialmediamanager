export type ContentTheme = 
  | 'motivational' 
  | 'educational' 
  | 'entertaining'
  | 'news' 
  | 'tips' 
  | 'quotes' 
  | 'facts' 
  | 'trends';

export interface GeneratedContent {
  caption: string;
  hashtags: string[];
  imagePrompt: string;
  theme: ContentTheme;
  suggestedTime: string;
  generatedAt: Date;
}

export interface ContentTemplate {
  id: string;
  name: string;
  theme: ContentTheme;
  captionTemplate: string;
  hashtagSets: string[][];
  imageStyle: string;
}
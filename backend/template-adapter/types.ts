export interface Placeholder {
    name: string;
    type: 'text' | 'url' | 'image' | 'block' | 'loop';
    selectorHint?: string;
    element?: string;
}

export interface DetectedCta {
    element: string;
    textPlaceholder: string;
    urlPlaceholder: string;
    originalText: string;
    originalHref: string;
}

export interface AdaptedTemplate {
    originalHtml: string;
    html: string;
    placeholders: Placeholder[];
    meta: {
        suggestedSubjects: string[];
        supportsPreheader: boolean;
        detectedCtas: DetectedCta[];
        detectedFooter: boolean;
        hasBlocks: string[];
    };
}

export interface PlaceholderMap {
    title?: string;
    preheader?: string;
    ctas: Array<{
        textVar: string;
        hrefVar: string;
    }>;
    blocks: Record<string, boolean>;
    brand?: Record<string, string>;
    event?: Record<string, string>;
}

export interface AdaptOptions {
    detectBlocks?: string[];
    ctaStrategy?: 'top_bottom' | 'all' | 'auto';
    preheaderFallback?: boolean;
    preserveComments?: boolean;
}

export interface RenderData {
    title?: string;
    preheader?: string;
    event?: Record<string, any>;
    brand?: Record<string, any>;
    speakers?: Array<Record<string, any>>;
    blocks?: Record<string, boolean>;
    [key: string]: any;
}

export interface ValidationReport {
    valid: boolean;
    errors: string[];
    warnings: string[];
    placeholders: string[];
    missingRequired?: string[];
}

export interface RenderResult {
    html: string;
    text: string;
}

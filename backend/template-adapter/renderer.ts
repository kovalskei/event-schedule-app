import * as cheerio from 'cheerio';
import { RenderData, RenderResult } from './types';

export function render(template: string, data: RenderData): RenderResult {
    let html = template;

    const processBlocks = (html: string): string => {
        const blockRegex = /\{\{#block:(\w+)\}\}([\s\S]*?)\{\{\/block:\1\}\}/g;
        
        return html.replace(blockRegex, (match, blockName, content) => {
            const shouldShow = data.blocks && data.blocks[blockName] === true;
            return shouldShow ? content : '';
        });
    };

    const processLoops = (html: string): string => {
        const loopRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
        
        return html.replace(loopRegex, (match, arrayName, template) => {
            const array = data[arrayName];
            
            if (!Array.isArray(array) || array.length === 0) {
                return '';
            }

            return array.map((item, index) => {
                let itemHtml = template;
                
                Object.keys(item).forEach(key => {
                    const value = item[key];
                    const placeholder = new RegExp(`\\{\\{${arrayName}\\.${key}\\}\\}`, 'g');
                    itemHtml = itemHtml.replace(placeholder, String(value));
                });

                itemHtml = itemHtml.replace(/\{\{@index\}\}/g, String(index));
                
                return itemHtml;
            }).join('');
        });
    };

    html = processBlocks(html);
    html = processLoops(html);

    const flattenData = (obj: any, prefix = ''): Record<string, string> => {
        const result: Record<string, string> = {};
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                const fullKey = prefix ? `${prefix}.${key}` : key;
                
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    Object.assign(result, flattenData(value, fullKey));
                } else if (!Array.isArray(value)) {
                    result[fullKey] = String(value);
                }
            }
        }
        
        return result;
    };

    const flatData = flattenData(data);

    Object.keys(flatData).forEach(key => {
        const value = flatData[key];
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        html = html.replace(placeholder, value);
    });

    html = html.replace(/\{\{[^}]+\}\}/g, '');

    const text = htmlToText(html);

    return { html, text };
}

export function htmlToText(html: string): string {
    const $ = cheerio.load(html, {
        decodeEntities: true
    });

    $('style, script, noscript').remove();

    $('img').each((i, elem) => {
        const alt = $(elem).attr('alt');
        if (alt) {
            $(elem).replaceWith(`[${alt}]`);
        } else {
            $(elem).remove();
        }
    });

    $('a').each((i, elem) => {
        const $el = $(elem);
        const text = $el.text().trim();
        const href = $el.attr('href');
        
        if (href && text) {
            $el.replaceWith(`${text} (${href})`);
        } else if (text) {
            $el.replaceWith(text);
        }
    });

    $('br').replaceWith('\n');
    $('p, div, h1, h2, h3, h4, h5, h6, li, tr').after('\n');
    $('td, th').after(' ');

    let text = $('body').text();

    text = text
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();

    return text;
}

export function extractPlaceholders(template: string): string[] {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = new Set<string>();
    
    let match;
    while ((match = placeholderRegex.exec(template)) !== null) {
        const placeholder = match[1].trim();
        
        if (!placeholder.startsWith('#') && !placeholder.startsWith('/')) {
            placeholders.add(placeholder);
        }
    }
    
    return Array.from(placeholders);
}

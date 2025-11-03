import * as cheerio from 'cheerio';
import { DetectedCta } from './types';

export class ElementDetector {
    private $: cheerio.CheerioAPI;

    constructor($: cheerio.CheerioAPI) {
        this.$ = $;
    }

    detectPreheader(): cheerio.Cheerio<any> | null {
        const $ = this.$;
        
        const candidates = $('body > *').slice(0, 5);
        
        for (let i = 0; i < candidates.length; i++) {
            const el = candidates.eq(i);
            const style = el.attr('style') || '';
            const text = el.text().trim();
            
            if (text.length === 0) continue;
            if (text.length > 200) continue;
            
            const isHidden = 
                style.includes('display:none') ||
                style.includes('display: none') ||
                style.includes('max-height:0') ||
                style.includes('max-height: 0') ||
                style.includes('opacity:0') ||
                style.includes('opacity: 0') ||
                style.includes('font-size:0') ||
                style.includes('font-size: 0') ||
                style.includes('font-size:1px') ||
                style.includes('font-size: 1px') ||
                el.css('display') === 'none' ||
                el.css('max-height') === '0' ||
                el.css('max-height') === '0px' ||
                el.css('opacity') === '0';
            
            if (isHidden && text.length > 10) {
                return el;
            }
        }
        
        return null;
    }

    detectCtas(): DetectedCta[] {
        const $ = this.$;
        const ctas: DetectedCta[] = [];
        const seen = new Set<string>();

        $('a').each((i, elem) => {
            const $el = $(elem);
            const href = $el.attr('href') || '';
            const text = $el.text().trim();
            
            if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
            if (text.length === 0) return;
            if (text.length > 100) return;
            
            const key = `${text}|${href}`;
            if (seen.has(key)) return;
            
            const style = $el.attr('style') || '';
            const classList = $el.attr('class') || '';
            const role = $el.attr('role') || '';
            
            const isCta = 
                style.includes('background') ||
                style.includes('border-radius') ||
                style.includes('padding') ||
                classList.match(/btn|button|cta|action/i) ||
                role === 'button' ||
                this.isTableButton($el);
            
            if (isCta) {
                seen.add(key);
                ctas.push({
                    element: $.html($el),
                    textPlaceholder: `cta_${ctas.length + 1}_text`,
                    urlPlaceholder: `cta_${ctas.length + 1}_url`,
                    originalText: text,
                    originalHref: href
                });
            }
        });

        return ctas;
    }

    detectFooter(): cheerio.Cheerio<any> | null {
        const $ = this.$;
        
        const footerKeywords = [
            'unsubscribe',
            'отписаться',
            'вы получили',
            'you received',
            'manage preferences',
            'privacy policy',
            'политика конфиденциальности',
            'все права защищены',
            'all rights reserved'
        ];

        let footerElement: cheerio.Cheerio<any> | null = null;

        $('footer, [role="contentinfo"], table[class*="footer"], div[class*="footer"]').each((i, elem) => {
            const $el = $(elem);
            const text = $el.text().toLowerCase();
            
            const hasKeyword = footerKeywords.some(kw => text.includes(kw.toLowerCase()));
            if (hasKeyword) {
                footerElement = $el;
                return false;
            }
        });

        if (!footerElement) {
            $('*').each((i, elem) => {
                const $el = $(elem);
                const text = $el.text().toLowerCase();
                
                if (text.length < 50 || text.length > 500) return;
                
                const matchCount = footerKeywords.filter(kw => 
                    text.includes(kw.toLowerCase())
                ).length;
                
                if (matchCount >= 2) {
                    footerElement = $el;
                    return false;
                }
            });
        }

        return footerElement;
    }

    detectBlocks(blockNames: string[]): Map<string, cheerio.Cheerio<any>> {
        const $ = this.$;
        const blocks = new Map<string, cheerio.Cheerio<any>>();

        blockNames.forEach(blockName => {
            const patterns = [
                `[class*="${blockName}"]`,
                `[id*="${blockName}"]`,
                `[data-block="${blockName}"]`,
                `.${blockName}`,
                `#${blockName}`
            ];

            for (const pattern of patterns) {
                const $el = $(pattern).first();
                if ($el.length > 0) {
                    blocks.set(blockName, $el);
                    break;
                }
            }
        });

        return blocks;
    }

    private isTableButton($el: cheerio.Cheerio<any>): boolean {
        const $ = this.$;
        let parent = $el.parent();
        let depth = 0;

        while (parent.length > 0 && depth < 3) {
            if (parent.is('td, th')) {
                const tdStyle = parent.attr('style') || '';
                if (tdStyle.includes('background') || tdStyle.includes('border-radius')) {
                    return true;
                }
            }
            parent = parent.parent();
            depth++;
        }

        return false;
    }

    detectTitle(): cheerio.Cheerio<any> | null {
        const $ = this.$;
        
        const titleSelectors = [
            'h1',
            '[class*="title"]',
            '[class*="heading"]',
            '[class*="headline"]',
            'td h1, td h2',
            'div h1, div h2'
        ];

        for (const selector of titleSelectors) {
            const $el = $(selector).first();
            if ($el.length > 0 && $el.text().trim().length > 0) {
                return $el;
            }
        }

        return null;
    }
}

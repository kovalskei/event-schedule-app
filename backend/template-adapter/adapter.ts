import * as cheerio from 'cheerio';
import { AdaptedTemplate, AdaptOptions, Placeholder, DetectedCta } from './types';
import { ElementDetector } from './detectors';

export async function adaptTemplate(
    html: string,
    options: AdaptOptions = {}
): Promise<AdaptedTemplate> {
    const {
        detectBlocks = ['speakers', 'agenda', 'hero', 'footer'],
        ctaStrategy = 'auto',
        preheaderFallback = true,
        preserveComments = false
    } = options;

    const $ = cheerio.load(html, {
        decodeEntities: false,
        xmlMode: false
    });

    const detector = new ElementDetector($);
    const placeholders: Placeholder[] = [];
    const detectedCtas: DetectedCta[] = [];
    const hasBlocks: string[] = [];

    const $preheader = detector.detectPreheader();
    let supportsPreheader = false;
    
    if ($preheader) {
        const originalText = $preheader.text();
        $preheader.text('{{preheader}}');
        placeholders.push({
            name: 'preheader',
            type: 'text',
            selectorHint: 'hidden text block at top'
        });
        supportsPreheader = true;
    } else if (preheaderFallback) {
        $('body').prepend(
            '<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">{{preheader}}</div>'
        );
        placeholders.push({
            name: 'preheader',
            type: 'text',
            selectorHint: 'auto-injected hidden block'
        });
        supportsPreheader = true;
    }

    const $title = detector.detectTitle();
    if ($title && $title.length > 0) {
        const originalText = $title.text();
        $title.text('{{title}}');
        placeholders.push({
            name: 'title',
            type: 'text',
            selectorHint: $title.prop('tagName')?.toLowerCase() || 'h1',
            element: 'title'
        });
    }

    const ctas = detector.detectCtas();
    
    let ctasToProcess: DetectedCta[] = [];
    if (ctaStrategy === 'top_bottom' && ctas.length >= 2) {
        ctasToProcess = [ctas[0], ctas[ctas.length - 1]];
        ctasToProcess[0].textPlaceholder = 'cta_top_text';
        ctasToProcess[0].urlPlaceholder = 'cta_top_url';
        ctasToProcess[1].textPlaceholder = 'cta_bottom_text';
        ctasToProcess[1].urlPlaceholder = 'cta_bottom_url';
    } else if (ctaStrategy === 'all') {
        ctasToProcess = ctas;
    } else {
        ctasToProcess = ctas.slice(0, 3);
    }

    ctasToProcess.forEach((cta, idx) => {
        $('a').each((i, elem) => {
            const $el = $(elem);
            if ($el.text().trim() === cta.originalText && $el.attr('href') === cta.originalHref) {
                $el.text(`{{${cta.textPlaceholder}}}`);
                $el.attr('href', `{{${cta.urlPlaceholder}}}`);
                
                placeholders.push({
                    name: cta.textPlaceholder,
                    type: 'text',
                    selectorHint: 'CTA button text'
                });
                placeholders.push({
                    name: cta.urlPlaceholder,
                    type: 'url',
                    selectorHint: 'CTA button URL'
                });
                
                detectedCtas.push(cta);
            }
        });
    });

    const detectedBlockElements = detector.detectBlocks(detectBlocks);
    detectedBlockElements.forEach((value, blockName) => {
        if (value && value.length > 0) {
            const html = $.html(value);
            const wrapped = `{{#block:${blockName}}}${html}{{/block:${blockName}}}`;
            value.replaceWith(wrapped);
            
            hasBlocks.push(blockName);
            placeholders.push({
                name: blockName,
                type: 'block',
                selectorHint: `block: ${blockName}`
            });
        }
    });

    const brandPatterns = [
        { regex: /\+7\s*\(\d{3}\)\s*\d{3}-\d{2}-\d{2}/g, placeholder: '{{brand.phone}}', name: 'brand.phone' },
        { regex: /\+\d{1,3}\s*\(\d{3}\)\s*\d{3}-\d{2}-\d{2}/g, placeholder: '{{brand.phone}}', name: 'brand.phone' },
        { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, placeholder: '{{brand.support}}', name: 'brand.support' }
    ];

    brandPatterns.forEach(({ regex, placeholder, name }) => {
        const bodyHtml = $.html('body');
        const matches = bodyHtml.match(regex);
        
        if (matches && matches.length > 0) {
            const firstMatch = matches[0];
            const escapedMatch = firstMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const replaced = $.html('body').replace(new RegExp(escapedMatch, 'g'), placeholder);
            $('body').html(replaced);
            
            if (!placeholders.find(p => p.name === name)) {
                placeholders.push({
                    name: name,
                    type: 'text',
                    selectorHint: 'brand contact info'
                });
            }
        }
    });

    if (!preserveComments) {
        $('*').contents().filter(function() {
            return this.type === 'comment';
        }).remove();
    }

    const adaptedHtml = $.html();

    const suggestedSubjects: string[] = [];
    if ($title && $title.text().includes('{{title}}')) {
        suggestedSubjects.push('{{title}}');
    }

    return {
        originalHtml: html,
        html: adaptedHtml,
        placeholders,
        meta: {
            suggestedSubjects,
            supportsPreheader,
            detectedCtas,
            detectedFooter: detector.detectFooter() !== null,
            hasBlocks
        }
    };
}

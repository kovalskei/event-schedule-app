/**
 * Business: Universal Template AI Adapter - converts raw HTML templates into AI-ready templates with placeholders
 * Args: event with httpMethod, body containing html/template/data
 * Returns: HTTP response with adapted template, render result, or validation report
 */

const cheerio = require('cheerio');

class ElementDetector {
    constructor($) {
        this.$ = $;
    }

    detectPreheader() {
        const $ = this.$;
        const candidates = $('body > *').slice(0, 5);
        
        for (let i = 0; i < candidates.length; i++) {
            const el = candidates.eq(i);
            const style = el.attr('style') || '';
            const text = el.text().trim();
            
            if (text.length === 0 || text.length > 200) continue;
            
            const isHidden = 
                style.includes('display:none') || style.includes('display: none') ||
                style.includes('max-height:0') || style.includes('max-height: 0') ||
                style.includes('opacity:0') || style.includes('opacity: 0') ||
                style.includes('font-size:0') || style.includes('font-size: 0') ||
                style.includes('font-size:1px') || style.includes('font-size: 1px') ||
                el.css('display') === 'none' || el.css('max-height') === '0' ||
                el.css('max-height') === '0px' || el.css('opacity') === '0';
            
            if (isHidden && text.length > 10) return el;
        }
        
        return null;
    }

    detectCtas() {
        const $ = this.$;
        const ctas = [];
        const seen = new Set();

        $('a').each((i, elem) => {
            const $el = $(elem);
            const href = $el.attr('href') || '';
            const text = $el.text().trim();
            
            if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
            if (text.length === 0 || text.length > 100) return;
            
            const key = `${text}|${href}`;
            if (seen.has(key)) return;
            
            const style = $el.attr('style') || '';
            const classList = $el.attr('class') || '';
            const role = $el.attr('role') || '';
            
            const isCta = 
                style.includes('background') || style.includes('border-radius') ||
                style.includes('padding') || (classList.match(/btn|button|cta|action/i)) ||
                role === 'button' || this.isTableButton($el);
            
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

    detectFooter() {
        const $ = this.$;
        const footerKeywords = ['unsubscribe', 'отписаться', 'вы получили', 'you received', 
            'manage preferences', 'privacy policy', 'политика конфиденциальности', 
            'все права защищены', 'all rights reserved'];

        let footerElement = null;

        $('footer, [role="contentinfo"], table[class*="footer"], div[class*="footer"]').each((i, elem) => {
            const $el = $(elem);
            const text = $el.text().toLowerCase();
            if (footerKeywords.some(kw => text.includes(kw.toLowerCase()))) {
                footerElement = $el;
                return false;
            }
        });

        if (!footerElement) {
            $('*').each((i, elem) => {
                const $el = $(elem);
                const text = $el.text().toLowerCase();
                if (text.length < 50 || text.length > 500) return;
                const matchCount = footerKeywords.filter(kw => text.includes(kw.toLowerCase())).length;
                if (matchCount >= 2) {
                    footerElement = $el;
                    return false;
                }
            });
        }

        return footerElement;
    }

    detectBlocks(blockNames) {
        const $ = this.$;
        const blocks = new Map();

        blockNames.forEach(blockName => {
            const patterns = [
                `[class*="${blockName}"]`, `[id*="${blockName}"]`,
                `[data-block="${blockName}"]`, `.${blockName}`, `#${blockName}`
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

    detectTitle() {
        const $ = this.$;
        const titleSelectors = ['h1', '[class*="title"]', '[class*="heading"]', 
            '[class*="headline"]', 'td h1, td h2', 'div h1, div h2'];

        for (const selector of titleSelectors) {
            const $el = $(selector).first();
            if ($el.length > 0 && $el.text().trim().length > 0) return $el;
        }

        return null;
    }

    isTableButton($el) {
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
}

async function adaptTemplate(html, options = {}) {
    const {
        detectBlocks = ['speakers', 'agenda', 'hero', 'footer'],
        ctaStrategy = 'auto',
        preheaderFallback = true,
        preserveComments = false
    } = options;

    const $ = cheerio.load(html, { decodeEntities: false, xmlMode: false });
    const detector = new ElementDetector($);
    const placeholders = [];
    const detectedCtas = [];
    const hasBlocks = [];

    const $preheader = detector.detectPreheader();
    let supportsPreheader = false;
    
    if ($preheader) {
        $preheader.text('{{preheader}}');
        placeholders.push({ name: 'preheader', type: 'text', selectorHint: 'hidden text block at top' });
        supportsPreheader = true;
    } else if (preheaderFallback) {
        $('body').prepend('<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">{{preheader}}</div>');
        placeholders.push({ name: 'preheader', type: 'text', selectorHint: 'auto-injected hidden block' });
        supportsPreheader = true;
    }

    const $title = detector.detectTitle();
    if ($title && $title.length > 0) {
        $title.text('{{title}}');
        const tagName = $title.prop('tagName');
        placeholders.push({ name: 'title', type: 'text', selectorHint: tagName ? tagName.toLowerCase() : 'h1', element: 'title' });
    }

    const ctas = detector.detectCtas();
    let ctasToProcess = [];
    
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

    ctasToProcess.forEach((cta) => {
        $('a').each((i, elem) => {
            const $el = $(elem);
            if ($el.text().trim() === cta.originalText && $el.attr('href') === cta.originalHref) {
                $el.text(`{{${cta.textPlaceholder}}}`);
                $el.attr('href', `{{${cta.urlPlaceholder}}}`);
                placeholders.push({ name: cta.textPlaceholder, type: 'text', selectorHint: 'CTA button text' });
                placeholders.push({ name: cta.urlPlaceholder, type: 'url', selectorHint: 'CTA button URL' });
                detectedCtas.push(cta);
            }
        });
    });

    const detectedBlockElements = detector.detectBlocks(detectBlocks);
    detectedBlockElements.forEach((value, blockName) => {
        if (value && value.length > 0) {
            const blockHtml = $.html(value);
            const wrapped = `{{#block:${blockName}}}${blockHtml}{{/block:${blockName}}}`;
            value.replaceWith(wrapped);
            hasBlocks.push(blockName);
            placeholders.push({ name: blockName, type: 'block', selectorHint: `block: ${blockName}` });
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
                placeholders.push({ name: name, type: 'text', selectorHint: 'brand contact info' });
            }
        }
    });

    if (!preserveComments) {
        $('*').contents().filter(function() { return this.type === 'comment'; }).remove();
    }

    const adaptedHtml = $.html();
    const suggestedSubjects = [];
    if ($title && $title.text().includes('{{title}}')) {
        suggestedSubjects.push('{{title}}');
    }

    return {
        originalHtml: html,
        html: adaptedHtml,
        placeholders,
        meta: { suggestedSubjects, supportsPreheader, detectedCtas, detectedFooter: detector.detectFooter() !== null, hasBlocks }
    };
}

function render(template, data) {
    let html = template;

    const processBlocks = (html) => {
        const blockRegex = /\{\{#block:(\w+)\}\}([\s\S]*?)\{\{\/block:\1\}\}/g;
        return html.replace(blockRegex, (match, blockName, content) => {
            const shouldShow = data.blocks && data.blocks[blockName] === true;
            return shouldShow ? content : '';
        });
    };

    const processLoops = (html) => {
        const loopRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
        return html.replace(loopRegex, (match, arrayName, template) => {
            const array = data[arrayName];
            if (!Array.isArray(array) || array.length === 0) return '';
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

    const flattenData = (obj, prefix = '') => {
        const result = {};
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

function htmlToText(html) {
    const $ = cheerio.load(html, { decodeEntities: true });
    $('style, script, noscript').remove();

    $('img').each((i, elem) => {
        const alt = $(elem).attr('alt');
        if (alt) $(elem).replaceWith(`[${alt}]`);
        else $(elem).remove();
    });

    $('a').each((i, elem) => {
        const $el = $(elem);
        const text = $el.text().trim();
        const href = $el.attr('href');
        if (href && text) $el.replaceWith(`${text} (${href})`);
        else if (text) $el.replaceWith(text);
    });

    $('br').replaceWith('\n');
    $('p, div, h1, h2, h3, h4, h5, h6, li, tr').after('\n');
    $('td, th').after(' ');

    let text = $('body').text();
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    return text;
}

function extractPlaceholders(template) {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders = new Set();
    let match;
    
    while ((match = placeholderRegex.exec(template)) !== null) {
        const placeholder = match[1].trim();
        if (!placeholder.startsWith('#') && !placeholder.startsWith('/')) {
            placeholders.add(placeholder);
        }
    }
    return Array.from(placeholders);
}

module.exports.handler = async (event, context) => {
    const { httpMethod, body } = event;
    const requestId = context.requestId;

    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            body: ''
        };
    }

    if (httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const data = JSON.parse(body || '{}');
    const action = data.action;

    if (action === 'adapt') {
        const html = data.html;
        const options = data.options || {};
        if (!html) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Missing html parameter' })
            };
        }
        const adapted = await adaptTemplate(html, options);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            isBase64Encoded: false,
            body: JSON.stringify({ success: true, adapted, requestId })
        };
    }

    if (action === 'render') {
        const template = data.template;
        const renderData = data.data || {};
        if (!template) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Missing template parameter' })
            };
        }
        const result = render(template, renderData);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            isBase64Encoded: false,
            body: JSON.stringify({ success: true, html: result.html, text: result.text, requestId })
        };
    }

    if (action === 'validate') {
        const template = data.template;
        if (!template) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Missing template parameter' })
            };
        }
        const placeholders = extractPlaceholders(template);
        const errors = [];
        const warnings = [];
        const requiredPlaceholders = ['title', 'preheader'];
        const missingRequired = requiredPlaceholders.filter(req => !placeholders.includes(req));
        if (missingRequired.length > 0) {
            warnings.push(`Missing recommended placeholders: ${missingRequired.join(', ')}`);
        }
        const hasCta = placeholders.some(p => p.includes('cta'));
        if (!hasCta) warnings.push('No CTA placeholders detected');
        const report = {
            valid: errors.length === 0,
            errors,
            warnings,
            placeholders,
            missingRequired: missingRequired.length > 0 ? missingRequired : undefined
        };
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            isBase64Encoded: false,
            body: JSON.stringify({ success: true, report, requestId })
        };
    }

    if (action === 'extract') {
        const template = data.template;
        if (!template) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Missing template parameter' })
            };
        }
        const placeholders = extractPlaceholders(template);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            isBase64Encoded: false,
            body: JSON.stringify({ success: true, placeholders, requestId })
        };
    }

    return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid action. Use: adapt, render, validate, or extract' })
    };
};

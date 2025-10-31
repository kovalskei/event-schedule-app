# V2 Email Generation Pipeline - Release Notes

## 🚀 Overview

V2 introduces a complete architectural redesign of the email generation system with:
- **Two-pass AI generation** (Plan → Slots) for better control
- **RAG-based context selection** instead of hard truncation
- **Strict HTML templates** with slot-based assembly
- **Comprehensive QA validation** before email save
- **Proper UTM normalization** and CTA mapping
- **Config hierarchy** for AI model selection

---

## 📦 What's New

### 1. **Two-Pass Generation**
   
**Pass 1: Planning**
- AI generates email plan (subject variants, angle, content selection)
- Selects relevant program items and pain points
- Chooses CTA buttons from allowed list
- Returns structured JSON (no HTML)

**Pass 2: Slot Filling**
- AI writes text content for defined slots
- Follows strict length limits from template schema
- Uses selected items from Pass 1
- Returns slot texts (no HTML)

**Benefits:**
- Predictable output structure
- Better quality control
- Reduced hallucinations
- Easier A/B testing (multiple subject variants)

---

### 2. **RAG (Retrieval-Augmented Generation)**

**Old way:** First 3000 chars of program, 2000 chars of pain points
**New way:** Semantic search with embeddings

**How it works:**
1. Program items, pain points, style snippets indexed with OpenAI embeddings
2. Query email title/segment to find top-k relevant items
3. Only relevant content sent to AI (6 program items, 4 pain points, 2 style examples)

**Benefits:**
- More relevant content selection
- Works with large program docs (thousands of items)
- Better personalization by segment

---

### 3. **Strict HTML Templates**

**Old way:** AI generates entire HTML (unpredictable, often broken)
**New way:** Pre-approved table-based templates with `{{slot.*}}` placeholders

**Template types:**
- `announcement` - General event announcement
- `invite` - Personal invitation style
- `reminder` - Urgency-focused reminder

**Features:**
- VML buttons for Outlook compatibility
- Inline CSS (no `<style>` tags)
- Mobile-responsive tables
- Alt text on all images
- Proper preheader placement

---

### 4. **QA Validation**

Automatic checks before email save:

**Blocking Errors:**
- Subject > 60 chars
- HTML > 100KB
- Missing required slots
- `<script>` or `<style>` tags
- `javascript:` protocols

**Warnings:**
- Preheader > 90 chars
- More than 1 emoji
- CAPS > 30%
- Images without alt
- Invalid/placeholder links
- Missing unsubscribe

**Status:**
- `generated` - all checks passed
- `requires_review` - has errors/warnings

---

### 5. **UTM Normalization**

**Proper URL handling:**
- Merges UTM params with existing query params
- Deduplicates parameters
- URL-encodes values
- Handles `?` vs `&` correctly
- Logs raw URL + final URL

**UTM params:**
- `utm_source` - from mailing list
- `utm_medium` - from mailing list
- `utm_campaign` - from mailing list
- `utm_content` - content type ID
- `utm_term` - email subject (slugified)

---

### 6. **CTA Mapping**

**Old way:** Placeholders `{{CTA_URL_0}}`, `{{CTA_URL_1}}`
**New way:** ID-based mapping from allowed_ctas

**Example:**
```json
{
  "allowed_ctas": [
    {"id": "register", "url": "https://event.com/reg", "label": "Зарегистрироваться"},
    {"id": "schedule", "url": "https://event.com/program", "label": "Программа"}
  ]
}
```

AI selects: `{"id": "register", "text": "Присоединяйтесь!"}`
System maps to URL + applies UTM

---

### 7. **Config Hierarchy**

**AI Model Resolution:**
```
content_plan.ai_model_override
  ↓ (if empty)
event_mailing_lists.ai_model_override
  ↓ (if empty)
events.default_ai_model
  ↓ (if empty)
GLOBAL_DEFAULT: 'gpt-4o-mini'
```

**Tone Resolution:**
```
content_plan.tone_override
  ↓ (if empty)
events.default_tone
  ↓ (if empty)
'professional'
```

---

## 🗄️ Database Changes

### New Tables
- `utm_logs` - UTM tracking per email

### Extended Tables

**events:**
- `default_ai_model` - default model for event
- `template_theme` - visual theme
- `brand_palette` - JSON color scheme
- `use_v2_pipeline` - enable V2 per event

**event_mailing_lists:**
- `ai_model_override` - override model per list
- `from_name`, `from_email`, `reply_to` - sender info
- `unsubscribe_url` - unsubscribe link

**email_templates:**
- `html_layout` - HTML template with slots
- `slots_schema` - JSON schema for slots
- `version` - template version

**content_plan:**
- `segment`, `offer_deadline`, `speakers_hint`
- `ab_variants` - number of A/B variants
- `language` - email locale
- `tone_override`, `ai_model_override`
- `status` - draft/generating/generated/failed

**content_types:**
- `allowed_ctas` - JSON array of CTA configs
- `default_cta_primary`, `default_cta_secondary`

**generated_emails:**
- `pipeline_version` - 'v1' or 'v2'
- `pass1_json`, `pass2_json` - AI responses
- `rag_sources` - IDs of used knowledge items
- `template_version` - template version used
- `qa_metrics` - QA validation results
- `plain_text` - plain text version
- `input_params` - generation parameters

**knowledge_store:**
- Stores embeddings for program/pain/style

---

## 🔧 New Files

**Core Modules:**
- `rag_module.py` - Embeddings + semantic search
- `v2_generation.py` - Two-pass AI generation
- `utm_utils.py` - UTM normalization + CTA mapping
- `template_assembler.py` - HTML assembly + QA validation
- `v2_pipeline.py` - Full V2 orchestrator

**Config/Examples:**
- `email_templates_examples.json` - Template examples
- `test_v2_pipeline.py` - Unit tests
- `V2_RELEASE_NOTES.md` - This file
- `V2_MIGRATION_GUIDE.md` - Migration instructions

---

## 🚦 Migration Plan

### Phase 1: Soft Launch (Week 1-2)
1. Deploy V2 code (backward compatible)
2. Set `use_v2_pipeline=FALSE` for all events
3. Test V2 on staging event
4. Monitor logs/metrics

### Phase 2: Pilot (Week 3-4)
1. Enable V2 for 1-2 small events
2. Compare V1 vs V2 email quality
3. Collect feedback
4. Fix issues

### Phase 3: Gradual Rollout (Month 2)
1. Enable V2 for 25% of events
2. Monitor error rates
3. Enable for 50%, then 75%
4. Full rollout at 100%

### Phase 4: Deprecate V1 (Month 3)
1. Migrate all events to V2
2. Mark V1 code as deprecated
3. Remove V1 after grace period

---

## ⚠️ Breaking Changes

### None (Fully Backward Compatible)

V2 pipeline is **opt-in** via `events.use_v2_pipeline` flag.

Existing V1 workflow continues to work unchanged.

---

## 🔄 Rollback Plan

If critical issues found:

1. Set `use_v2_pipeline=FALSE` for affected events
2. Emails revert to V1 generation instantly
3. Investigate V2 issues offline
4. Fix and re-enable

**Data Safety:**
- V2 writes to same `generated_emails` table
- `pipeline_version` field distinguishes V1/V2
- No data loss on rollback

---

## 📊 Success Metrics

**Quality:**
- QA pass rate > 95%
- User-reported errors < 2%
- Template rendering issues < 1%

**Performance:**
- Generation time < 30s (vs V1: ~15s)
- RAG retrieval < 2s
- Pass1 + Pass2 < 25s

**Engagement:**
- Open rate improvement: +5-10%
- Click rate improvement: +10-15%
- Unsubscribe rate: no change or better

---

## 🐛 Known Limitations

1. **RAG requires embeddings:** Events must index knowledge_store first
2. **Slower than V1:** Two AI calls instead of one (~2x time)
3. **Template dependency:** Need templates for each content_type
4. **No HTML customization:** Strict templates (less flexibility)

---

## 📞 Support

**Issues:** Report to development team
**Questions:** Check `V2_MIGRATION_GUIDE.md`
**Logs:** Use `get_logs` tool with source `backend/events-manager`

---

## 🎯 Next Steps

1. **Read** `V2_MIGRATION_GUIDE.md`
2. **Run** tests: `python test_v2_pipeline.py`
3. **Index** knowledge store for your event
4. **Create** HTML templates for content types
5. **Enable** `use_v2_pipeline=TRUE` for pilot event
6. **Monitor** generation logs and QA metrics
7. **Iterate** based on feedback

---

**Version:** 2.0.0  
**Release Date:** 2024-10-31  
**Status:** Production Ready (Opt-in)

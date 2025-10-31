# V2 Email Generation - Migration Guide

## 🎯 Quick Start

This guide helps you migrate from V1 to V2 email generation pipeline.

---

## ✅ Prerequisites

Before enabling V2 for an event:

1. ✅ Database migration applied (V0019)
2. ✅ Knowledge store indexed (program items, pain points, style snippets)
3. ✅ Email templates created with `html_layout` and `slots_schema`
4. ✅ Content types configured with `allowed_ctas`
5. ✅ Environment variables set (`OPENAI_API_KEY` or `OPENROUTER_API_KEY`)

---

## 📋 Step-by-Step Migration

### Step 1: Index Knowledge Store

**Index program items from Google Sheets:**

```python
from rag_module import index_program_items

# Example program data from Google Sheets
program_data = [
    {
        'title': 'Building Scalable APIs',
        'speaker': 'Jane Smith (Google)',
        'time': '10:00-11:00',
        'track': 'Backend',
        'hall': 'Room A',
        'abstract': 'Learn how to design APIs that scale to millions of requests...',
        'tags': ['api', 'scalability', 'backend']
    },
    # ... more items
]

# Call backend endpoint to index
POST /api/events-manager
{
    "action": "index_knowledge",
    "event_id": 123,
    "type": "program_items",
    "data": program_data
}
```

**Index pain points from Google Doc:**

```python
pain_points = [
    "Устаём от ручной работы с данными",
    "Не знаем как масштабировать инфраструктуру",
    "Нужны примеры реальных кейсов"
]

POST /api/events-manager
{
    "action": "index_knowledge",
    "event_id": 123,
    "type": "pain_points",
    "data": pain_points
}
```

**Index style snippets:**

```python
style_snippets = [
    "Привет! Мы рады пригласить вас...",
    "Не упустите возможность узнать..."
]

POST /api/events-manager
{
    "action": "index_knowledge",
    "event_id": 123,
    "type": "style_snippets",
    "data": style_snippets
}
```

---

### Step 2: Create Email Templates

**Using examples from `email_templates_examples.json`:**

```sql
INSERT INTO t_p22819116_event_schedule_app.email_templates 
(event_id, content_type_id, name, html_layout, slots_schema, version)
VALUES (
    123,  -- your event_id
    1,    -- content_type_id for "announcement"
    'Announcement Email',
    '<!DOCTYPE html>...',  -- from email_templates_examples.json
    '{
        "required": ["hero_title", "intro", "benefits_bullets", "cta_primary"],
        "properties": {
            "hero_title": {"maxLength": 80},
            "intro": {"maxLength": 300},
            ...
        }
    }'::jsonb,
    1
);
```

**Or use API:**

```python
POST /api/events-manager
{
    "action": "create_template",
    "event_id": 123,
    "content_type_id": 1,
    "template_type": "announcement"  # auto-loads from examples
}
```

---

### Step 3: Configure Content Types

**Set allowed CTAs:**

```sql
UPDATE t_p22819116_event_schedule_app.content_types
SET 
    allowed_ctas = '[
        {"id": "register", "url": "https://event.com/register", "label": "Зарегистрироваться"},
        {"id": "schedule", "url": "https://event.com/schedule", "label": "Посмотреть программу"},
        {"id": "speakers", "url": "https://event.com/speakers", "label": "Спикеры"}
    ]'::jsonb,
    default_cta_primary = 'https://event.com/register',
    default_cta_secondary = 'https://event.com/schedule'
WHERE id = 1;
```

---

### Step 4: Configure Event Settings

**Set AI model and tone:**

```sql
UPDATE t_p22819116_event_schedule_app.events
SET 
    default_ai_model = 'gpt-4o-mini',
    default_tone = 'professional',
    logo_url = 'https://cdn.example.com/logo.png',
    use_v2_pipeline = TRUE  -- ⚠️ This enables V2!
WHERE id = 123;
```

---

### Step 5: Create Content Plan

**Add items to content_plan table:**

```sql
INSERT INTO t_p22819116_event_schedule_app.content_plan
(event_id, list_id, title, content_type_id, segment, language, ab_variants, status)
VALUES
(123, 5, 'Топ-5 докладов про AI', 1, 'developers', 'ru-RU', 2, 'draft'),
(123, 5, 'Не пропустите регистрацию', 2, 'managers', 'ru-RU', 2, 'draft');
```

**Or import from Google Sheets:**

```python
POST /api/events-manager
{
    "action": "import_content_plan",
    "event_id": 123,
    "list_id": 5,
    "google_sheet_url": "https://docs.google.com/spreadsheets/d/..."
}
```

---

### Step 6: Generate Emails

**Call V2 pipeline:**

```python
from v2_pipeline import generate_email_v2

result = generate_email_v2(
    conn=db_connection,
    content_plan_id=101,
    variant_index=0  # First subject variant
)

if result['success']:
    print(f"✅ Email generated: {result['email_id']}")
    print(f"Subject: {result['subject']}")
    print(f"QA passed: {result['qa_report']['passed']}")
else:
    print(f"❌ Error: {result['error']}")
```

**Or via API:**

```python
POST /api/events-manager
{
    "action": "generate_email_v2",
    "content_plan_id": 101,
    "variant_index": 0
}
```

**Response:**

```json
{
    "success": true,
    "email_id": 1523,
    "subject": "Топ-5 докладов про AI на TechSummit 2024",
    "preheader": "Узнайте о будущем искусственного интеллекта",
    "qa_report": {
        "passed": true,
        "errors": [],
        "warnings": ["1 images without alt attribute"],
        "metrics": {
            "subject_length": 42,
            "preheader_length": 45,
            "html_size_kb": 12.3
        }
    }
}
```

---

## 🔍 Monitoring & Debugging

### Check Generation Logs

```python
from get_logs import get_logs

logs = get_logs(source='backend/events-manager', limit=100)

# Look for:
# [V2] Starting generation...
# [PASS1] Attempt 1/2
# [PASS2] Success: 6 slots filled
# [V2] QA: passed=True
```

### Verify RAG Results

```sql
SELECT 
    ge.id,
    ge.subject,
    ge.rag_sources,
    ge.qa_metrics
FROM t_p22819116_event_schedule_app.generated_emails ge
WHERE ge.pipeline_version = 'v2'
ORDER BY ge.created_at DESC
LIMIT 10;
```

### Inspect Pass1/Pass2 JSON

```sql
SELECT 
    id,
    subject,
    pass1_json->'subject_variants' as variants,
    pass1_json->'ctas' as ctas,
    pass2_json->'slots' as slots
FROM t_p22819116_event_schedule_app.generated_emails
WHERE id = 1523;
```

---

## 🐛 Troubleshooting

### Issue: "No RAG results found"

**Cause:** Knowledge store not indexed

**Fix:**
1. Check: `SELECT COUNT(*) FROM knowledge_store WHERE event_id = 123`
2. If 0, run Step 1 (Index Knowledge Store)

---

### Issue: "No template found"

**Cause:** Missing email_template for content_type

**Fix:**
1. Check: `SELECT * FROM email_templates WHERE event_id = 123`
2. If empty, run Step 2 (Create Email Templates)

---

### Issue: "CTA ID not found in allowed_ctas"

**Cause:** AI selected invalid CTA ID

**Fix:**
1. Check content_types.allowed_ctas
2. Update with correct IDs
3. AI will fallback to default_cta_primary

---

### Issue: "Pass1 failed: JSON parse error"

**Cause:** AI returned invalid JSON

**Fix:**
- Usually auto-retries (2 attempts)
- If persists, check model (`gpt-4o-mini` recommended)
- Reduce temperature (0.5 default)

---

### Issue: "QA validation failed"

**Cause:** Email has errors (subject too long, missing slots, etc.)

**Fix:**
1. Check `qa_metrics` in database
2. Email saved with `status='requires_review'`
3. Fix manually or regenerate

---

## 📊 Comparison: V1 vs V2

| Feature | V1 | V2 |
|---------|----|----|
| AI Calls | 1 (full HTML) | 2 (plan + slots) |
| Context | First N chars | RAG top-k |
| HTML Quality | Unpredictable | Strict templates |
| QA Checks | None | Comprehensive |
| UTM Handling | Basic replacement | Proper normalization |
| CTA Mapping | Placeholder-based | ID-based with fallback |
| A/B Variants | Manual | Built-in (subject_variants) |
| Generation Time | ~15s | ~30s |
| Error Rate | ~10-15% | ~2-5% |

---

## 🎓 Best Practices

### 1. Content Plan Titles
- ✅ **Good:** "Топ-3 доклада про DevOps"
- ❌ **Bad:** "Письмо #5"

### 2. Allowed CTAs
- ✅ Include 3-5 CTA options
- ✅ Use clear IDs: `register`, `schedule`, `speakers`
- ❌ Don't use generic: `cta1`, `button2`

### 3. Slots Schema
- ✅ Set realistic `maxLength` limits
- ✅ Mark essential slots as `required`
- ❌ Don't make everything optional

### 4. Knowledge Store
- ✅ Re-index when program changes
- ✅ Keep pain points atomic (1 pain per item)
- ✅ Include 5-10 style snippets

### 5. QA Metrics
- ✅ Monitor `qa_metrics` weekly
- ✅ Fix common warnings (missing alt, long subject)
- ✅ Set up alerts for error rate > 5%

---

## 🔄 Rollback to V1

If issues arise:

```sql
UPDATE t_p22819116_event_schedule_app.events
SET use_v2_pipeline = FALSE
WHERE id = 123;
```

**All future emails revert to V1 instantly.**

Existing V2 emails remain in database unchanged.

---

## 📞 Support

**Questions:** Check V2_RELEASE_NOTES.md  
**Issues:** Report to development team  
**Logs:** `get_logs(source='backend/events-manager')`

---

## ✅ Migration Checklist

- [ ] Database migration V0019 applied
- [ ] Knowledge store indexed (program, pain, style)
- [ ] Email templates created for all content types
- [ ] Content types configured with allowed_ctas
- [ ] Event settings updated (ai_model, tone, logo)
- [ ] Content plan populated
- [ ] Test email generated successfully
- [ ] QA validation passed
- [ ] Logs reviewed (no errors)
- [ ] `use_v2_pipeline=TRUE` enabled

---

**Good luck with V2! 🚀**

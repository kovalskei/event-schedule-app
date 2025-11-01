# V2 Email Generation Schemas

JSON Schema definitions for V2 slot-based email generation system.

## Files

### v2_slots_schema.json
Defines the structure of email slots:
- **intro**: Opening section with text and highlights
- **speakers**: Array of featured speakers (max 3)
- **cta**: Call-to-action button
- **footer**: Optional contact information

### v2_model_output_schema.json
Expected JSON output from AI model when generating V2 emails:
```json
{
  "subject": "Email subject line",
  "preheader": "Short summary text",
  "slots": {
    "intro": {...},
    "speakers": [...],
    "cta": {...}
  }
}
```

## Usage

### In Backend Functions
```python
from pydantic import BaseModel, ValidationError

class SlotsIntro(BaseModel):
    text: str

class SlotsSpeaker(BaseModel):
    topic: str
    teaser: str | None = None
    name: str | None = None
    job: str | None = None
    company: str | None = None

class SlotsCTA(BaseModel):
    text: str
    url: str

class Slots(BaseModel):
    intro: SlotsIntro
    speakers: list[SlotsSpeaker]
    cta: SlotsCTA

class LLMOutV2(BaseModel):
    subject: str
    preheader: str | None = None
    slots: Slots

# Validate AI output
try:
    parsed = LLMOutV2(**ai_output)
except ValidationError as e:
    print(f"Invalid output: {e}")
```

### In Email Templates
Store `slots_schema` in `email_templates.slots_schema` column:
```sql
UPDATE email_templates 
SET slots_schema = '{"intro": {"type": "object"}, "speakers": {"type": "array"}}'
WHERE id = 1;
```

## Benefits

1. **Type Safety**: Pydantic validates AI output
2. **Consistency**: All emails follow same structure
3. **Flexibility**: Easy to add new slots without changing templates
4. **Maintainability**: Clear contract between AI and rendering

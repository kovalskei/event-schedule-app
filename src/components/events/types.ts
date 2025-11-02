export interface Event {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  program_doc_id: string;
  pain_doc_id: string;
  default_tone: string;
  email_template_examples: string;
  logo_url?: string;
  cta_base_url?: string;
  use_v2_pipeline?: boolean;
}

export interface ContentType {
  id: number;
  name: string;
  description: string;
  cta_urls?: Array<{ label: string; url: string }>;
}

export interface EmailTemplate {
  id: number;
  content_type_id: number;
  content_type_name: string;
  name: string;
  html_template: string;
  subject_template: string;
  instructions: string;
}

export const EVENTS_MANAGER_URL = 'https://functions.poehali.dev/b56e5895-fb22-4d96-b746-b046a9fd2750';
export const IMAGE_UPLOADER_URL = 'https://functions.poehali.dev/61daaad5-eb92-4f21-8104-8760f8d0094e';
export const INDEX_KNOWLEDGE_URL = 'https://functions.poehali.dev/814ac16e-cb58-4603-b3af-4b6f9215fb05';
export const TEMPLATE_GENERATOR_URL = 'https://functions.poehali.dev/616d6890-24c3-49c8-8b29-692dd342933b';

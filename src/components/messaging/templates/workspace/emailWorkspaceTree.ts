import type { EmailTemplateSection } from '@/types/emailTemplateWorkspace';

export function flattenEmailSections(sections: EmailTemplateSection[]): EmailTemplateSection[] {
  return sections.flatMap(section => [section, ...(section.columns ?? []).flat()]);
}
export function mapEmailSections(sections: EmailTemplateSection[], transform: (section: EmailTemplateSection) => EmailTemplateSection): EmailTemplateSection[] {
  return sections.map(section => transform(section.columns ? { ...section, columns: section.columns.map(column => column.map(transform)) } : section));
}
export function freshEmailSection(section: EmailTemplateSection): EmailTemplateSection {
  return { ...structuredClone(section), id: crypto.randomUUID(), ...(section.columns ? { columns: section.columns.map(column => column.map(freshEmailSection)) } : {}) };
}

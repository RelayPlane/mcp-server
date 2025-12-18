/**
 * Invoice Processor Skill
 *
 * Extract, validate, and summarize invoice data using a multi-model AI workflow.
 *
 * ## Context Efficiency
 * Without this skill: ~15k tokens (extraction + validation + summarization all in context)
 * With this skill: ~500 tokens (only final summary in context)
 * **Context reduction: 97%**
 *
 * ## Models Used
 * - GPT-4o: Extraction (vision-capable)
 * - Claude 3.5 Sonnet: Validation (strong reasoning)
 * - GPT-4o-mini: Summarization (fast, cheap)
 */

export const invoiceProcessorConfig = {
  name: 'invoice-processor',
  description: 'Extract, validate, and summarize invoice data from images or PDFs.',
  category: 'extraction',
  contextReduction: '97%',

  steps: [
    {
      name: 'extract',
      model: 'openai:gpt-4o',
      prompt: `Extract all invoice fields from the provided document:
- Invoice number
- Vendor name and address
- Invoice date and due date
- Line items (description, quantity, unit price, total)
- Subtotal, tax, and total
- Payment terms

Return as structured JSON.`,
      schema: {
        type: 'object',
        properties: {
          invoiceNumber: { type: 'string' },
          vendor: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: { type: 'string' },
            },
          },
          dates: {
            type: 'object',
            properties: {
              invoiceDate: { type: 'string' },
              dueDate: { type: 'string' },
            },
          },
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number' },
                total: { type: 'number' },
              },
            },
          },
          totals: {
            type: 'object',
            properties: {
              subtotal: { type: 'number' },
              tax: { type: 'number' },
              total: { type: 'number' },
            },
          },
          paymentTerms: { type: 'string' },
        },
      },
    },
    {
      name: 'validate',
      model: 'anthropic:claude-3-5-sonnet-20241022',
      depends: ['extract'],
      prompt: `Validate the extracted invoice data:
1. Verify line item totals match (quantity × unit price = total)
2. Verify subtotal matches sum of line items
3. Verify total = subtotal + tax
4. Flag any discrepancies or suspicious values

Extracted data:
{{steps.extract.output}}

Return validation results with any errors or warnings.`,
    },
    {
      name: 'summarize',
      model: 'openai:gpt-4o-mini',
      depends: ['validate'],
      prompt: `Create a 2-sentence executive summary for finance approval.

Invoice data: {{steps.extract.output}}
Validation: {{steps.validate.output}}

Include: vendor name, total amount, due date, and any validation concerns.`,
    },
  ],

  estimatedCost: '$0.02-0.05 per invoice',
};

/**
 * Get the workflow configuration for invoice processing
 */
export function getInvoiceProcessorWorkflow(fileUrl: string) {
  return {
    name: invoiceProcessorConfig.name,
    steps: invoiceProcessorConfig.steps,
    input: { fileUrl },
  };
}

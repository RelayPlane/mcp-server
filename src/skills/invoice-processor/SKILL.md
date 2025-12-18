# Invoice Processor

Extract, validate, and summarize invoice data using a multi-model AI workflow.

## Context Efficiency

| Approach | Tokens Through Context |
|----------|------------------------|
| Direct tool calls | ~15,000 |
| This skill | ~500 |
| **Reduction** | **97%** |

Heavy data (extracted fields, validation notes) stays in the workflow engine.
Only the final summary enters your context.

## Usage

```typescript
import { relay } from "@relayplane/sdk";

const result = await relay
  .workflow("invoice-processor")
  .step("extract")
    .with("openai:gpt-4o")
    .prompt("Extract all invoice fields: number, vendor, date, line items, totals.")
  .step("validate")
    .with("anthropic:claude-3-5-sonnet-20241022")
    .depends("extract")
    .prompt("Verify line item totals match invoice total. Flag any discrepancies.")
  .step("summarize")
    .with("openai:gpt-4o-mini")
    .depends("validate")
    .prompt("Create 2-sentence executive summary for finance approval.")
  .run({ fileUrl: "https://example.com/invoice.pdf" });

console.log(result.finalOutput); // Executive summary
console.log(result.steps.extract.output); // Full extracted data (if needed)
```

## Models Used

| Step | Model | Why |
|------|-------|-----|
| Extract | openai:gpt-4o | Vision-capable, good at structured extraction |
| Validate | anthropic:claude-3-5-sonnet-20241022 | Strong reasoning for math verification |
| Summarize | openai:gpt-4o-mini | Fast and cheap for simple text generation |

## Estimated Cost

~$0.02-0.05 per invoice (provider costs only, RelayPlane is BYOK)

## Output Schema

```typescript
interface InvoiceData {
  invoiceNumber: string;
  vendor: {
    name: string;
    address: string;
  };
  dates: {
    invoiceDate: string;
    dueDate: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totals: {
    subtotal: number;
    tax: number;
    total: number;
  };
  paymentTerms: string;
}
```

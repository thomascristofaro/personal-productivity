"use client"

import { SelectField } from "@/components/page/fields"
import { FormField } from "@/components/page/form-field"
import { PageForm } from "@/components/page/page-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useFormState } from "@/hooks/use-form-state"
import type { FormAction } from "@/lib/form"
import { REASONING_LEVELS } from "@/lib/schemas/llm-function"

const FIELD_ORDER = [
  "prompt",
  "model",
  "reasoning",
  "temperature",
  "maxTokens",
] as const

type Props = {
  id: string
  action: FormAction
  initial: {
    prompt: string
    model: string
    temperature: number
    maxTokens: number
    reasoning: string
  }
}

export function FunctionForm({ id, action, initial }: Props) {
  const form = useFormState(action, FIELD_ORDER, {
    prompt: initial.prompt,
    model: initial.model,
    temperature: String(initial.temperature),
    maxTokens: String(initial.maxTokens),
    reasoning: initial.reasoning,
  })

  return (
    <PageForm form={form} cancelHref="/impostazioni/llm">
      <input type="hidden" name="id" value={id} />

      <FormField
        name="prompt"
        label="Prompt"
        description="Le istruzioni che accompagnano ogni chiamata. La forma della risposta non si cambia da qui."
        error={form.errorOf("prompt")}
      >
        <Textarea
          {...form.fieldProps("prompt", { described: true })}
          key={form.fieldKey("prompt")}
          rows={18}
          spellCheck={false}
        />
      </FormField>

      <FormField name="model" label="Modello" error={form.errorOf("model")}>
        <Input
          {...form.fieldProps("model")}
          key={form.fieldKey("model")}
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>

      <SelectField
        {...form.fieldProps("reasoning", { described: true })}
        key={form.fieldKey("reasoning")}
        label="Ragionamento"
        description="Quanto il modello ragiona prima di rispondere. Scala dell'AI SDK, non di Google: vale anche cambiando fornitore."
        error={form.errorOf("reasoning")}
        options={REASONING_LEVELS}
      />

      <FormField
        name="temperature"
        label="Temperatura"
        description="Da 0 a 2. Più alta, più varia la scelta."
        error={form.errorOf("temperature")}
      >
        <Input
          {...form.fieldProps("temperature", { described: true })}
          key={form.fieldKey("temperature")}
          type="number"
          inputMode="decimal"
          step="0.1"
          min={0}
          max={2}
          autoComplete="off"
        />
      </FormField>

      <FormField
        name="maxTokens"
        label="Limite di token in uscita"
        error={form.errorOf("maxTokens")}
      >
        <Input
          {...form.fieldProps("maxTokens")}
          key={form.fieldKey("maxTokens")}
          type="number"
          inputMode="numeric"
          min={1}
          autoComplete="off"
        />
      </FormField>
    </PageForm>
  )
}

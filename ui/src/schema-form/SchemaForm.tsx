import { useMemo, useState } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { buildArguments, fieldsFromSchema, initialValues, type Field, type FormValues } from "./schema";

interface Props {
  schema: unknown;
  submitting: boolean;
  onSubmit: (args: Record<string, unknown>) => void;
}

/** A Cloudscape form rendered entirely from a tool's input schema (ADR-003). */
export function SchemaForm({ schema, submitting, onSubmit }: Props) {
  const fields = useMemo(() => fieldsFromSchema(schema), [schema]);
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: string, value: string | boolean) => setValues((v) => ({ ...v, [name]: value }));

  const submit = () => {
    const result = buildArguments(fields, values);
    if (result.ok) {
      setErrors({});
      onSubmit(result.args);
    } else {
      setErrors(result.errors);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Form
        actions={
          <Button variant="primary" formAction="submit" loading={submitting}>
            Call tool
          </Button>
        }
      >
        {fields.length === 0 ? (
          <Box color="text-body-secondary">This tool takes no parameters.</Box>
        ) : (
          <SpaceBetween size="m">
            {fields.map((f) => (
              <SchemaField key={f.name} field={f} value={values[f.name]} error={errors[f.name]} onChange={set} />
            ))}
          </SpaceBetween>
        )}
      </Form>
    </form>
  );
}

function SchemaField({
  field,
  value,
  error,
  onChange,
}: {
  field: Field;
  value: string | boolean | undefined;
  error?: string;
  onChange: (name: string, value: string | boolean) => void;
}) {
  const label = field.required ? field.label : (
    <span>
      {field.label} <i>- optional</i>
    </span>
  );
  const text = typeof value === "string" ? value : "";

  let control;
  switch (field.kind) {
    case "boolean":
      control = (
        <Checkbox checked={value === true} onChange={({ detail }) => onChange(field.name, detail.checked)}>
          {field.label}
        </Checkbox>
      );
      break;
    case "enum": {
      const options = (field.options ?? []).map((o) => ({ label: o, value: o }));
      control = (
        <Select
          selectedOption={options.find((o) => o.value === text) ?? null}
          options={field.required ? options : [{ label: "(none)", value: "" }, ...options]}
          onChange={({ detail }) => onChange(field.name, detail.selectedOption.value ?? "")}
          placeholder="Choose a value"
        />
      );
      break;
    }
    case "json":
      control = <Textarea value={text} onChange={({ detail }) => onChange(field.name, detail.value)} placeholder="JSON" />;
      break;
    default:
      control = (
        <Input
          value={text}
          type={field.kind === "string" ? "text" : "number"}
          inputMode={field.kind === "integer" ? "numeric" : field.kind === "number" ? "decimal" : undefined}
          onChange={({ detail }) => onChange(field.name, detail.value)}
        />
      );
  }

  return (
    <FormField label={label} description={field.description} errorText={error} constraintText={field.name}>
      {control}
    </FormField>
  );
}

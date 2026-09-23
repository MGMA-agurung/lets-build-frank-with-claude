import { useCallback, useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import type { CallToolResult, FrankClient, Tool } from "../frank/client";
import { resultPayload, resultSummary } from "../frank/result";
import { SchemaForm } from "../schema-form/SchemaForm";

type Listing = { kind: "loading" } | { kind: "ok"; tools: Tool[] } | { kind: "error"; message: string };

type Call =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: CallToolResult }
  | { kind: "failed"; message: string };

/** Frank's tools from MCP discovery, with a schema-driven form for each (ADR-003). */
export function Tools({ client }: { client: FrankClient }) {
  const [listing, setListing] = useState<Listing>({ kind: "loading" });
  const [selected, setSelected] = useState<Tool | null>(null);
  const [call, setCall] = useState<Call>({ kind: "idle" });

  const load = useCallback(async () => {
    setListing({ kind: "loading" });
    try {
      const tools = await client.listTools();
      setListing({ kind: "ok", tools });
      setSelected((current) => tools.find((t) => t.name === current?.name) ?? null);
    } catch (error) {
      setListing({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const select = (tool: Tool | null) => {
    setSelected(tool);
    setCall({ kind: "idle" });
  };

  const invoke = async (args: Record<string, unknown>) => {
    if (!selected) return;
    setCall({ kind: "running" });
    try {
      setCall({ kind: "done", result: await client.callTool(selected.name, args) });
    } catch (error) {
      setCall({ kind: "failed", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const tools = listing.kind === "ok" ? listing.tools : [];

  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Everything Frank exposes over MCP. Select a tool to call it.">
          Tools
        </Header>
      }
    >
      <SpaceBetween size="l">
        {listing.kind === "error" && (
          <Alert type="error" header="Could not list Frank's tools">
            {listing.message}
          </Alert>
        )}

        <Table
          header={
            <Header
              variant="h2"
              counter={listing.kind === "ok" ? `(${tools.length})` : undefined}
              actions={
                <Button iconName="refresh" ariaLabel="Refresh tools" onClick={() => void load()} loading={listing.kind === "loading"} />
              }
            >
              Available tools
            </Header>
          }
          items={tools}
          loading={listing.kind === "loading"}
          loadingText="Asking Frank for his tools"
          selectionType="single"
          selectedItems={selected ? [selected] : []}
          onSelectionChange={({ detail }) => select(detail.selectedItems[0] ?? null)}
          onRowClick={({ detail }) => select(detail.item)}
          trackBy="name"
          ariaLabels={{
            selectionGroupLabel: "Tool selection",
            itemSelectionLabel: (_s, item) => item.name,
            allItemsSelectionLabel: () => "all tools",
          }}
          columnDefinitions={[
            { id: "name", header: "Name", cell: (t) => <Box variant="code">{t.name}</Box>, width: 240 },
            { id: "description", header: "Description", cell: (t) => t.description ?? "-" },
          ]}
          empty={<Box textAlign="center">Frank has no tools yet.</Box>}
        />

        {selected && (
          <Container header={<Header variant="h2" description={selected.description}>{selected.title ?? selected.name}</Header>}>
            <SchemaForm
              key={selected.name}
              schema={selected.inputSchema}
              submitting={call.kind === "running"}
              onSubmit={(args) => void invoke(args)}
            />
          </Container>
        )}

        {selected && call.kind === "failed" && (
          <Alert type="error" header="Frank did not answer">
            {call.message}
          </Alert>
        )}

        {selected && call.kind === "done" && <ToolResult result={call.result} />}
      </SpaceBetween>
    </ContentLayout>
  );
}

function ToolResult({ result }: { result: CallToolResult }) {
  const summary = resultSummary(result);
  return (
    <Container header={<Header variant="h2">Result</Header>}>
      <SpaceBetween size="m">
        {result.isError ? (
          <Alert type="error" header="The tool reported an error">
            {summary ?? "No message."}
          </Alert>
        ) : (
          summary && <Box variant="p">{summary}</Box>
        )}
        <Box variant="pre" data-testid="tool-result-json">
          {JSON.stringify(resultPayload(result), null, 2)}
        </Box>
      </SpaceBetween>
    </Container>
  );
}

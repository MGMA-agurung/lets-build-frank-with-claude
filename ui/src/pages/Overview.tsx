import { useCallback, useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import type { FrankClient } from "../frank/client";
import { resultPayload, resultSummary } from "../frank/result";

interface Status {
  summary: string;
  version: string;
  uptimeSeconds: number;
  startedAt: string;
  greeting: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; status: Status; checkedAt: Date; latencyMs: number }
  | { kind: "error"; message: string };

/** Frank's get_status output and connection health (ADR-003). */
export function Overview({ client }: { client: FrankClient }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    const started = performance.now();
    try {
      const result = await client.callTool("get_status", {});
      if (result.isError) {
        setState({ kind: "error", message: resultSummary(result) ?? "get_status returned an error." });
        return;
      }
      setState({
        kind: "ok",
        status: resultPayload(result) as Status,
        checkedAt: new Date(),
        latencyMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Frank's status and whether this console can reach him."
          actions={
            <Button iconName="refresh" onClick={() => void refresh()} loading={state.kind === "loading"}>
              Refresh
            </Button>
          }
        >
          Overview
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Connection</Header>}>
          <KeyValuePairs
            columns={3}
            items={[
              { label: "MCP endpoint", value: <Box variant="code">/mcp</Box> },
              {
                label: "Health",
                value:
                  state.kind === "loading" ? (
                    <StatusIndicator type="loading">Checking</StatusIndicator>
                  ) : state.kind === "ok" ? (
                    <StatusIndicator type="success">Connected</StatusIndicator>
                  ) : (
                    <StatusIndicator type="error">Unreachable</StatusIndicator>
                  ),
              },
              {
                label: "Last check",
                value: state.kind === "ok" ? `${state.checkedAt.toLocaleTimeString()} (${state.latencyMs} ms)` : "-",
              },
            ]}
          />
        </Container>

        {state.kind === "error" && (
          <Alert type="error" header="Frank did not answer">
            {state.message}
          </Alert>
        )}

        {state.kind === "ok" && (
          <Container header={<Header variant="h2" description={state.status.summary}>Status</Header>}>
            <KeyValuePairs
              columns={2}
              items={[
                { label: "Version", value: state.status.version },
                { label: "Uptime", value: `${state.status.uptimeSeconds} s` },
                { label: "Started", value: new Date(state.status.startedAt).toLocaleString() },
                { label: "Greeting", value: state.status.greeting },
              ]}
            />
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
}

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import type { CallToolResult, FrankClient, Tool } from "../src/frank/client";

const status = {
  summary: "Frank 0.1.0 is up and has been running for 42s.",
  version: "0.1.0",
  uptimeSeconds: 42,
  startedAt: "2026-09-01T12:00:00.000Z",
  greeting: "Hello, I'm Frank.",
};

const getStatusTool: Tool = {
  name: "get_status",
  title: "Get status",
  description: "Returns Frank's version, uptime and a greeting.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

// A tool the UI has never heard of: it must still get a form (ADR-003).
const searchTool: Tool = {
  name: "search_widgets",
  description: "Searches widgets by name.",
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string", description: "Text to search for." },
      limit: { type: "integer", description: "Most results to return." },
    },
  },
};

function fakeClient(overrides: Partial<FrankClient> = {}): FrankClient {
  return {
    listTools: vi.fn(async () => [getStatusTool, searchTool]),
    callTool: vi.fn(async (name: string, args: Record<string, unknown>): Promise<CallToolResult> => {
      if (name === "get_status") return { content: [{ type: "text", text: JSON.stringify(status) }], structuredContent: status };
      const out = { summary: `Found 1 widget for ${String(args.query)}.`, args };
      return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
    }),
    ...overrides,
  };
}

describe("Overview page", () => {
  it("shows get_status output and a healthy connection", async () => {
    const client = fakeClient();
    render(<App client={client} initialPage="overview" />);

    expect(await screen.findByText(status.summary)).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Hello, I'm Frank.")).toBeInTheDocument();
    expect(client.callTool).toHaveBeenCalledWith("get_status", {});
  });

  it("says Frank did not answer when the call fails", async () => {
    const client = fakeClient({ callTool: vi.fn(async () => Promise.reject(new Error("fetch failed"))) });
    render(<App client={client} initialPage="overview" />);

    expect(await screen.findByText("Frank did not answer")).toBeInTheDocument();
    expect(screen.getByText("fetch failed")).toBeInTheDocument();
    expect(screen.getByText("Unreachable")).toBeInTheDocument();
  });
});

describe("Tools page", () => {
  it("lists tools from discovery", async () => {
    render(<App client={fakeClient()} initialPage="tools" />);

    expect(await screen.findByText("get_status")).toBeInTheDocument();
    expect(screen.getByText("search_widgets")).toBeInTheDocument();
    expect(screen.getByText("Searches widgets by name.")).toBeInTheDocument();
  });

  it("renders a form from an unknown tool's schema and shows the JSON result", async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    render(<App client={client} initialPage="tools" />);

    await user.click(await screen.findByText("search_widgets"));
    const query = await screen.findByLabelText("query");
    expect(screen.getByText("Text to search for.")).toBeInTheDocument();

    // Required field is enforced before anything is sent.
    await user.click(screen.getByRole("button", { name: "Call tool" }));
    expect(await screen.findByText("Required.")).toBeInTheDocument();
    expect(client.callTool).not.toHaveBeenCalled();

    await user.type(query, "sprocket");
    await user.type(screen.getByLabelText(/limit/), "5");
    await user.click(screen.getByRole("button", { name: "Call tool" }));

    await waitFor(() => expect(client.callTool).toHaveBeenCalledWith("search_widgets", { query: "sprocket", limit: 5 }));
    expect(await screen.findByText("Found 1 widget for sprocket.")).toBeInTheDocument();
    expect(screen.getByTestId("tool-result-json").textContent).toContain('"limit": 5');
  });

  it("calls a parameterless tool with empty arguments", async () => {
    const user = userEvent.setup();
    const client = fakeClient();
    render(<App client={client} initialPage="tools" />);

    await user.click(await screen.findByText("get_status"));
    expect(await screen.findByText("This tool takes no parameters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Call tool" }));

    await waitFor(() => expect(client.callTool).toHaveBeenCalledWith("get_status", {}));
    expect(await screen.findByText(status.summary)).toBeInTheDocument();
  });

  it("shows a tool's isError message as an error", async () => {
    const user = userEvent.setup();
    const client = fakeClient({
      callTool: vi.fn(async () => ({ isError: true, content: [{ type: "text" as const, text: "Frank can't read that yet." }] })),
    });
    render(<App client={client} initialPage="tools" />);

    await user.click(await screen.findByText("get_status"));
    await user.click(await screen.findByRole("button", { name: "Call tool" }));

    expect(await screen.findByText("The tool reported an error")).toBeInTheDocument();
    expect(screen.getAllByText("Frank can't read that yet.").length).toBeGreaterThan(0);
  });
});

describe("navigation", () => {
  it("switches between Overview and Tools from the side navigation", async () => {
    const user = userEvent.setup();
    render(<App client={fakeClient()} initialPage="overview" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Tools" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Tools" })).toBeInTheDocument();
  });
});

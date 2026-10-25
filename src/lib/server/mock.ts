import "server-only";

/**
 * LOCAL TEST ONLY mock of the Semaphore v4 API.
 *
 * This module is reachable ONLY when the explicit env var MOCK_UPSTREAM=1 is
 * set (see mockEnabled()). It is never used in production: upstream.ts routes
 * to the real Semaphore API whenever the flag is absent, and every function
 * here throws unless the flag is set — so a production deploy without the
 * flag cannot accidentally serve mock data.
 *
 * Shape mirrors Semaphore v4: POST messages/priority/otp returns an array of
 * message rows; GET account returns { credit_balance }; GET messages/:id
 * returns one row. message_ids are random per call (the mock is stateless),
 * so callers must assert counts, balances, and stored sender names — not IDs.
 */

export function mockEnabled(): boolean {
  return process.env.MOCK_UPSTREAM === "1";
}

function assertMock(): void {
  if (!mockEnabled()) {
    throw new Error("Mock upstream is disabled (set MOCK_UPSTREAM=1 for local tests only).");
  }
}

function networkFor(number: string): string {
  const p = number.slice(0, 4);
  if (["0917", "0905", "0906", "0915", "0916", "0927", "0935", "0975"].includes(p)) return "Globe";
  if (["0919", "0908", "0918", "0920", "0921", "0939", "0946", "0947", "0949", "0989"].includes(p)) return "Smart";
  if (["0991", "0992", "0993", "0994", "0895", "0896", "0897", "0898"].includes(p)) return "DITO";
  if (["0922", "0923", "0932", "0933", "0943"].includes(p)) return "Sun";
  return "Globe";
}

export type MockMessageRow = {
  message_id: number;
  recipient: string;
  message: string;
  sender_name: string;
  network: string;
  status: string;
  type: string;
  created_at: string;
  updated_at: string;
};

function nowSql(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function mockSend(
  numbers: string[],
  message: string,
  kind: string,
  code: string | null,
  senderName: string,
): MockMessageRow[] {
  assertMock();
  const ts = nowSql();
  const finalMessage =
    kind === "otp" ? message.replace("{otp}", code ?? String(Math.floor(100000 + Math.random() * 900000))) : message;
  return numbers.map((recipient) => ({
    message_id: Math.floor(100000 + Math.random() * 900000000),
    recipient,
    message: finalMessage,
    sender_name: senderName,
    network: networkFor(recipient),
    status: "Sent",
    type: "Single",
    created_at: ts,
    updated_at: ts,
  }));
}

export function mockAccount(): { credit_balance: number } {
  assertMock();
  return { credit_balance: 100000 };
}

export function mockMessage(id: number): MockMessageRow {
  assertMock();
  const ts = nowSql();
  return {
    message_id: id,
    recipient: "09171234567",
    message: "Mock message",
    sender_name: "SMMSOFT",
    network: "Globe",
    status: "Sent",
    type: "Single",
    created_at: ts,
    updated_at: ts,
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env";
import { HdevTransport } from "./transport";

/**
 * The wire format the gateway actually expects.
 *
 * This exists because getting it wrong is invisible. The first version of
 * this transport posted a JSON body with the credentials as fields, which is
 * what a REST API would want — the gateway answered 200, every send reported
 * success, and no message was ever delivered. Nothing in the application
 * noticed, because SMS is fire-and-forget by design: it must not fail the
 * request that triggered it.
 *
 * So the shape is pinned here rather than left to be discovered again from a
 * user asking why nobody is receiving texts. The reference is the gateway's
 * own PHP client: credentials in the path, form-encoded body, `ref=sms`,
 * recipient in `tel`.
 */

const ORIGINAL_FETCH = globalThis.fetch;

function reply(body: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

/** The single call the transport made, unpacked into something assertable. */
async function captured(fetchMock: ReturnType<typeof reply>) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const form = init.body as FormData;
  return {
    url,
    method: init.method,
    fields: Object.fromEntries([...form.entries()]) as Record<string, string>,
    headers: init.headers,
  };
}

let fetchMock: ReturnType<typeof reply>;

beforeEach(() => {
  fetchMock = reply({ status: "success", message: "Message sent" });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("HDev transport", () => {
  it("puts the credentials in the path, not the body", async () => {
    await new HdevTransport().send({ to: "250788123456", message: "hello" });

    const call = await captured(fetchMock);
    const base = env.HDEV_SMS_URL.replace(/\/+$/, "");

    expect(call.url).toBe(
      `${base}/${encodeURIComponent(env.HDEV_API_ID)}/${encodeURIComponent(env.HDEV_API_KEY)}`
    );
    // The mistake that cost real delivery: credentials as body fields.
    expect(call.fields.api_id).toBeUndefined();
    expect(call.fields.api_key).toBeUndefined();
  });

  it("posts form data with the fields the gateway reads", async () => {
    await new HdevTransport().send({ to: "250788123456", message: "your code is 482917" });

    const call = await captured(fetchMock);

    expect(call.method).toBe("POST");
    // `ref` selects the operation; the same key also does mobile-money
    // top-ups, so omitting it is not a no-op.
    expect(call.fields.ref).toBe("sms");
    expect(call.fields.sender_id).toBe(env.HDEV_SENDER_ID);
    expect(call.fields.tel).toBe("250788123456");
    expect(call.fields.message).toBe("your code is 482917");
  });

  it("lets fetch write the Content-Type, so the multipart boundary is right", async () => {
    await new HdevTransport().send({ to: "250788123456", message: "hello" });

    const call = await captured(fetchMock);
    // A hand-written multipart Content-Type has no boundary and the body
    // arrives unparseable — another 200 that delivers nothing.
    expect(call.headers).toBeUndefined();
  });

  it("does not double the slash when the base URL has a trailing one", async () => {
    const previous = env.HDEV_SMS_URL;
    (env as { HDEV_SMS_URL: string }).HDEV_SMS_URL = "https://sms-api.hdev.rw/api_pay/api/";
    try {
      await new HdevTransport().send({ to: "250788123456", message: "hello" });
      expect((await captured(fetchMock)).url).not.toContain("api//");
    } finally {
      (env as { HDEV_SMS_URL: string }).HDEV_SMS_URL = previous;
    }
  });
});

describe("HDev failures", () => {
  it("treats a 200 carrying a refusal as an error", async () => {
    // The gateway reports insufficient balance and an unknown sender id this
    // way. Reading the status code alone calls both of them a success.
    fetchMock = reply({ status: "error", message: "insufficient balance" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new HdevTransport().send({ to: "250788123456", message: "hello" })
    ).rejects.toThrow(/insufficient balance/);
  });

  it("treats a non-JSON 200 as an error", async () => {
    // A PHP notice or an HTML error page comes back with a 200.
    fetchMock = reply("<br /><b>Warning</b>: something", 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new HdevTransport().send({ to: "250788123456", message: "hello" })
    ).rejects.toThrow(/non-JSON/);
  });

  it("reports the status and body on a non-2xx", async () => {
    fetchMock = reply({ message: "bad credentials" }, 401);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new HdevTransport().send({ to: "250788123456", message: "hello" })
    ).rejects.toThrow(/401/);
  });

  it.each([
    [{ status: 200 }],
    [{ status: "success" }],
    [{ status: "ok" }],
    [{ success: true }],
  ])("accepts %j", async (body) => {
    fetchMock = reply(body);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      new HdevTransport().send({ to: "250788123456", message: "hello" })
    ).resolves.toBeUndefined();
  });
});

import { startNock, stopNock } from "testing/nock";
import { describe, expect, test } from "vitest";
import endpoints from "../endpoints/endpoints";
const authToken = () => process.env.SENDGRID_API_KEY ?? "";

describe("sendgrid.endpoints", async () => {
  test("mailSend simple", async () => {
    const api_key = authToken();

    const nockDone = await startNock("sendgrid.mailSend");
    const data = await endpoints.mailSend.request({
      body: {
        from: {
          email: "matt@email.trigger.dev",
        },
        subject: "Hello, World!",
        content: [
          {
            type: "text/plain",
            value: "Email body here",
          },
        ],
        personalizations: [
          {
            to: [
              {
                email: "matt@trigger.dev",
              },
            ],
            subject: "Hello, World!",
          },
        ],
      },
      credentials: {
        type: "api_key",
        name: "api_key",
        api_key,
        scopes: ["mail.send"],
      },
    });

    expect(data.status).toBeGreaterThanOrEqual(200);
    expect(data.status).toBeLessThan(300);
    expect(data.success).toEqual(true);
    expect(data.body).not.toBeNull();
    stopNock(nockDone);
  });

  test("marketingContacts", async () => {
    const api_key = authToken();

    const nockDone = await startNock("sendgrid.marketingContacts");
    const data = await endpoints.marketingContacts.request({
      body: {
        contacts: [
          {
            email: "matt+1@mattaitken.com",
            first_name: "Matt",
            last_name: "Aitken",
          },
        ],
      },
      credentials: {
        type: "api_key",
        name: "api_key",
        api_key,
        scopes: ["mail.send"],
      },
    });

    expect(data.status).toBeGreaterThanOrEqual(200);
    expect(data.status).toBeLessThan(300);
    expect(data.success).toEqual(true);
    expect(data.body).not.toBeNull();
    stopNock(nockDone);
  });
});

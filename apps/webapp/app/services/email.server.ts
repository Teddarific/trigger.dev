import type { DeliverEmail } from "emails";
import { EmailClient } from "emails";
import type { SendEmailOptions } from "remix-auth-email-link";
import { env } from "~/env.server";
import type { User } from "~/models/user.server";
import type { AuthUser } from "./authUser";
import { taskQueue } from "./messageBroker.server";

const client = new EmailClient({
  apikey: env.RESEND_API_KEY,
  imagesBaseUrl: env.APP_ORIGIN,
  from: env.FROM_EMAIL,
  replyTo: env.REPLY_TO_EMAIL,
});

export async function sendMagicLinkEmail(
  options: SendEmailOptions<AuthUser>
): Promise<void> {
  return client.send({
    email: "magic_link",
    to: options.emailAddress,
    magicLink: options.magicLink,
  });
}

export async function scheduleWelcomeEmail(user: User) {
  //delay for one minute in development, longer in production
  const delay =
    process.env.NODE_ENV === "development" ? 1000 * 60 : 1000 * 60 * 22;

  await taskQueue.publish(
    "DELIVER_EMAIL",
    {
      email: "welcome",
      to: user.email,
      name: user.name ?? undefined,
    },
    {},
    { deliverAfter: delay }
  );
}

export async function sendEmail(data: DeliverEmail) {
  return client.send(data);
}

/**
 * Simple helper to exercise the n8n QR email webhook from the command line.
 *
 * Usage:
 *   bun run tsx scripts/test-send-qrcode.ts \
 *     --url https://mchahrour.app.n8n.cloud/webhook-test/send-qrcode \
 *     --rid visit:test-123 \
 *     --email guest@example.com
 *
 * Any extra JSON fields you pass via --data will be forwarded to the webhook.
 */

type CliArgs = {
  url: string;
  rid?: string;
  email?: string;
  data?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { url: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--url") {
      args.url = argv[++index] ?? "";
    } else if (value === "--rid") {
      args.rid = argv[++index];
    } else if (value === "--email") {
      args.email = argv[++index];
    } else if (value === "--data") {
      args.data = argv[++index];
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error("Missing --url");
    process.exit(1);
  }

  let extra: Record<string, unknown> = {};
  if (args.data) {
    try {
      extra = JSON.parse(args.data);
    } catch (error) {
      console.error("Failed to parse --data JSON:", error);
      process.exit(1);
    }
  }

  const payload = {
    rid: args.rid ?? `visit:test-${Date.now()}`,
    email: args.email ?? "guest@example.com",
    ...extra,
  };

  console.info("POST", args.url);
  console.info("Payload:", payload);

  const response = await fetch(args.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  console.info("Status:", response.status);
  console.info("Response body:", text);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


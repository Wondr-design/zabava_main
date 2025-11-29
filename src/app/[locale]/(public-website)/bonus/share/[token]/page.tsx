import { BonusShareClient } from "./bonus-share-client";

export default async function BonusSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BonusShareClient token={token} />;
}

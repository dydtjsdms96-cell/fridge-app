import { redirect } from "next/navigation";

type AddPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** HTTPS entry for Bixby / share sheets → home voice-add flow */
export default async function AddViaDeepLinkPage({
  searchParams,
}: AddPageProps) {
  const sp = await searchParams;
  const text =
    first(sp.text) ??
    first(sp.q) ??
    first(sp.query) ??
    first(sp.utterance) ??
    first(sp.voiceAdd);

  if (text?.trim()) {
    redirect(`/?voiceAdd=${encodeURIComponent(text.trim())}`);
  }
  redirect("/");
}

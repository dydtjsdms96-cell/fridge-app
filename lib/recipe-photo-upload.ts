import { createClient } from "@/lib/supabase";

const BUCKET = "recipe-photos";

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 5) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

/** Upload under `{userId}/{recipeId}.{ext}` and return public URL. */
export async function uploadRecipePhoto(opts: {
  userId: string;
  recipeId: string;
  file: File;
}): Promise<string> {
  const supabase = createClient();
  const ext = extFromFile(opts.file);
  const path = `${opts.userId}/${opts.recipeId}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, opts.file, {
    upsert: true,
    contentType: opts.file.type || `image/${ext}`,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // bust cache after overwrite
  return `${data.publicUrl}?t=${Date.now()}`;
}

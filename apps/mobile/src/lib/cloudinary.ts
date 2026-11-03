import { File, UploadType } from "expo-file-system";
import { EduApiClient } from "@edu/api-client";
import { API_URL } from "../config";

export type CloudinaryFolder =
  | "students"
  | "users"
  | "assignments"
  | "content"
  | "documents"
  | "branding"
  | "payments";

type SignResponse = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
};

type UploadAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type CloudinaryUpload = {
  url: string;
  name: string;
  mimeType: string;
};

function inferMimeType(asset: UploadAsset) {
  if (asset.mimeType) return asset.mimeType;
  const extension = asset.name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Uploads a local file to Cloudinary using a server-signed request.
 *
 * Uses the native multipart uploader instead of `fetch` + `FormData` because
 * Expo SDK 58's `fetch` does not support React Native's `{ uri, name, type }`
 * FormData parts, while React Native's `Blob` cannot be built from a byte
 * array. Streaming the file natively also keeps large files out of JS memory.
 */
export async function uploadToCloudinary(
  asset: UploadAsset,
  folder: CloudinaryFolder,
  token: string,
): Promise<CloudinaryUpload> {
  const mimeType = inferMimeType(asset);
  const resourceType = mimeType.startsWith("image/") ? "image" : "raw";
  const signed = await new EduApiClient(API_URL, () => token).post<SignResponse>(
    "/uploads/sign",
    { folder, resourceType },
  );
  const result = await new File(asset.uri).upload(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`,
    {
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      parameters: {
        api_key: signed.apiKey,
        timestamp: String(signed.timestamp),
        signature: signed.signature,
        folder: signed.folder,
      },
    },
  );
  let uploaded: {
    secure_url?: string;
    error?: { message?: string };
  };
  try {
    uploaded = JSON.parse(result.body) as typeof uploaded;
  } catch {
    throw new Error(`File upload failed (Cloudinary returned HTTP ${result.status})`);
  }
  if (result.status < 200 || result.status >= 300 || !uploaded.secure_url) {
    throw new Error(uploaded.error?.message ?? "File upload failed");
  }
  return { url: uploaded.secure_url, name: asset.name, mimeType };
}

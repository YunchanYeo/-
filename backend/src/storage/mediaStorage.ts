import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Request } from 'express';
import OSS from 'ali-oss';

type MediaKind = 'image' | 'voice';

function detectExt(kind: MediaKind, mimeType: string) {
  if (kind === 'image') {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    return 'jpg';
  }
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  return 'mp3';
}

function safeBaseName(name: string) {
  return String(name || 'upload')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .slice(0, 40);
}

function isAliyunOssEnabled() {
  return String(process.env.MEDIA_PROVIDER || '').trim().toLowerCase() === 'aliyun-oss';
}

function createAliyunClient() {
  const region = String(process.env.OSS_REGION || '').trim();
  const bucket = String(process.env.OSS_BUCKET || '').trim();
  const accessKeyId = String(process.env.OSS_ACCESS_KEY_ID || '').trim();
  const accessKeySecret = String(process.env.OSS_ACCESS_KEY_SECRET || '').trim();
  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error('Aliyun OSS env missing: OSS_REGION/OSS_BUCKET/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET');
  }
  return new OSS({ region, bucket, accessKeyId, accessKeySecret });
}

function buildOssPublicUrl(objectKey: string) {
  const customBase = String(process.env.OSS_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (customBase) return `${customBase}/${objectKey}`;
  const bucket = String(process.env.OSS_BUCKET || '').trim();
  const region = String(process.env.OSS_REGION || '').trim();
  if (!bucket || !region) throw new Error('OSS_PUBLIC_BASE_URL or OSS_BUCKET/OSS_REGION required');
  return `https://${bucket}.${region}.aliyuncs.com/${objectKey}`;
}

export async function saveMediaFromBase64(params: {
  kind: MediaKind;
  mimeType: string;
  fileName: string;
  base64Data: string;
  req: Request;
  uploadsDir: string;
  prefix: string;
}) {
  const { kind, mimeType, fileName, base64Data, req, uploadsDir, prefix } = params;
  const ext = detectExt(kind, mimeType);
  const base = safeBaseName(fileName || kind);
  const finalName = `${prefix}_${Date.now()}_${base || kind}_${crypto.randomInt(1000, 9999)}.${ext}`;
  const buf = Buffer.from(base64Data, 'base64');
  return saveMediaFromBuffer({
    kind,
    mimeType,
    fileName: finalName,
    buffer: buf,
    req,
    uploadsDir,
  });
}

export async function saveMediaFromBuffer(params: {
  kind: MediaKind;
  mimeType: string;
  fileName: string;
  buffer: Buffer;
  uploadsDir: string;
  req?: Request;
  objectPrefix?: string;
}) {
  const { buffer, uploadsDir, fileName, req, objectPrefix = 'uploads' } = params;
  const finalName = String(fileName || '').trim();
  if (!finalName) throw new Error('fileName required');
  if (isAliyunOssEnabled()) {
    const client = createAliyunClient();
    const objectKey = `${String(objectPrefix || 'uploads').replace(/^\/+|\/+$/g, '')}/${finalName}`;
    await client.put(objectKey, buffer, {
      headers: {
        'Cache-Control': 'public, max-age=31536000',
      },
    });
    return buildOssPublicUrl(objectKey);
  }
  const targetPath = path.join(uploadsDir, finalName);
  fs.writeFileSync(targetPath, buffer);
  if (!req) throw new Error('req is required for local media url');
  return `${req.protocol}://${req.get('host')}/uploads/${finalName}`;
}


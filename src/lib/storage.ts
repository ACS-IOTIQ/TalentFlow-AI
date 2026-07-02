import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  },
  forcePathStyle: true,
})

export const BUCKETS = {
  RESUMES: process.env.MINIO_BUCKET_RESUMES || 'talentflow-resumes',
  JDS: process.env.MINIO_BUCKET_JDS || 'talentflow-jds',
  PROFILES: process.env.MINIO_BUCKET_PROFILES || 'talentflow-profiles',
  AVATARS: process.env.MINIO_BUCKET_AVATARS || 'talentflow-avatars',
} as const

export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
  return key
}

export async function getSignedDownloadUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export function getPublicUrl(bucket: string, key: string): string {
  const base = process.env.MINIO_PUBLIC_ENDPOINT || 'http://localhost:9000'
  return `${base}/${bucket}/${key}`
}

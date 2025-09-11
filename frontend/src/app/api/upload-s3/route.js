import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const userName = formData.get('userName');
        
        if (!file || !userName) {
            return NextResponse.json({
                error: 'File and userName are required'
            }, { status: 400 });
        }

        const bucketName = process.env.AWS_S3_BUCKET_NAME;
        const fileName = `video_${Date.now()}.mp4`;
        const key = `${fileName}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: file,
            ContentType: file.type || 'video/mp4'
        });

        await s3Client.send(command);

        return NextResponse.json({
            success: true,
            s3Key: key,
            url: `https://${bucketName}.s3.amazonaws.com/${key}`
        });

    } catch (error) {
        console.error('S3 upload error:', error);
        return NextResponse.json({
            error: 'Failed to upload file to S3',
            details: error.message
        }, { status: 500 });
    }
}
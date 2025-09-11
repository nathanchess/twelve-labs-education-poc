import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

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
        const downloadUri = formData.get('file');
        const userName = formData.get('userName');
        
        if (!downloadUri || !userName) {
            return NextResponse.json({
                error: 'File and userName are required'
            }, { status: 400 });
        }

        const response = await fetch(downloadUri)
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const bucketName = process.env.AWS_S3_BUCKET_NAME;
        const fileName = `video_${Date.now()}.mp4`;
        const key = `${fileName}`;

        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: bucketName,
                Key: key,
                // 4. The Body is the stream from the fetch response
                Body: response.body,
                // Get ContentType from the download response headers if available
                ContentType: response.headers.get('content-type') || 'video/mp4'
            },
        });

        // 5. Wait for the upload to complete
        await upload.done();

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
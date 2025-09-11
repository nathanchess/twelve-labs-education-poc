import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const googleClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
    try {
        const formData = await request.formData();
        const filePath = formData.get('file');
        const userName = formData.get('userName');

        if (!filePath || !userName) {
            return NextResponse.json({
                error: 'File and userName are required'
            }, { status: 400 });
        }

        const response = await fetch(filePath)
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const fileBuffer = Buffer.from(await response.arrayBuffer());

        // 2. Create a temporary local file path
        const mimeType = response.headers.get('content-type') || 'application/octet-stream';
        const url = new URL(filePath);
        const pathname = url.pathname;
        const originalFileName = pathname.substring(pathname.lastIndexOf('/') + 1);
        const tempFileName = `${userName}-${Date.now()}-${originalFileName}`;
        const tempFilePath = join(tmpdir(), tempFileName);

        // 3. Write the downloaded file buffer to the temporary path
        await writeFile(tempFilePath, fileBuffer);

        try {
            // Upload file to Gemini using the correct API
            const myfile = await googleClient.files.upload({
                file: tempFilePath,
                config: { 
                    mimeType: mimeType || 'video/mp4' 
                },
            });

            return NextResponse.json({
                success: true,
                geminiFileId: myfile.uri,
                fileName: originalFileName
            });

        } finally {
            // Clean up the temporary file
            try {
                await unlink(tempFilePath);
            } catch (cleanupError) {
                console.warn('Failed to cleanup temp file:', cleanupError);
            }
        }
        
    } catch (error) {
        console.error('Error uploading video to Gemini:', error);
        return NextResponse.json({
            error: 'Failed to upload video to Gemini',
            details: error.message
        }, { status: 500 });
    }
}

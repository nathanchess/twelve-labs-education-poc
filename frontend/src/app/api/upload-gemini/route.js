import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const googleClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
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

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create a temporary file path
        const tempFileName = `${userName}-${Date.now()}-${file.name}`;
        const tempFilePath = join(tmpdir(), tempFileName);

        // Write the buffer to a temporary file
        await writeFile(tempFilePath, buffer);

        try {
            // Upload file to Gemini using the correct API
            const myfile = await googleClient.files.upload({
                file: tempFilePath,
                config: { 
                    mimeType: file.type || 'video/mp4' 
                },
            });

            console.log('Gemini upload successful:', myfile.uri);

            return NextResponse.json({
                success: true,
                geminiFileId: myfile.uri,
                fileName: file.name
            });

        } finally {
            // Clean up the temporary file
            try {
                await writeFile(tempFilePath, ''); // Clear the file
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

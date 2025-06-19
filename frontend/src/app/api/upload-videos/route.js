import { NextResponse } from 'next/server';

import { TwelveLabs } from 'twelvelabs-js';

export async function POST(request) {
  try {
    // Handle FormData for single video
    const formData = await request.formData();
    
    // Extract single video file and metadata
    const videoFile = formData.get('video');
    const metadata = JSON.parse(formData.get('video_metadata'));
    
    if (!videoFile) {
      return NextResponse.json(
        { success: false, message: 'No video file provided' },
        { status: 400 }
      );
    }

    console.log('Received video for processing:', metadata.name);
    console.log('Video metadata:', metadata);

    const twelvelabs_client = new TwelveLabs({apiKey: process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY})

    // TODO: Process video with TwelveLabs here
    // You can now access the video as:
    // videoFile - the actual video blob/file
    // metadata - the file metadata (name, size, type, date)
    
    // For now, return a success response
    return NextResponse.json(
      { 
        success: true, 
        message: 'Video processed successfully',
        data: {
          processedVideo: metadata.name,
          fileSize: metadata.size,
          fileType: metadata.type
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process video',
        error: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Upload videos endpoint - use POST to process videos' },
    { status: 200 }
  );
} 
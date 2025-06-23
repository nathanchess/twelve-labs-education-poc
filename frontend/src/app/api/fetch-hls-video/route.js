import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { videoId } = body;

    // Validate required fields
    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing required field: videoId' },
        { status: 400 }
      );
    }

    // Check if TwelveLabs API key is available
    const apiKey = process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY;
    const indexId = process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID;

    if (!apiKey || !indexId) {
      return NextResponse.json(
        { error: 'TwelveLabs configuration not found' },
        { status: 500 }
      );
    }

    // Fetch video data from TwelveLabs API
    const videoUrl = `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos/${videoId}?transcription=true`;
    
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('TwelveLabs API error:', errorData);
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch video from TwelveLabs',
          details: errorData.message || response.statusText,
          status: response.status
        },
        { status: response.status }
      );
    }

    const videoData = await response.json();
    
    // Extract HLS URL from the response
    const hlsUrl = videoData.hls?.video_url;
    
    if (!hlsUrl) {
      return NextResponse.json(
        { error: 'HLS URL not available for this video' },
        { status: 404 }
      );
    }

    // Return the HLS URL and video metadata
    return NextResponse.json({
      success: true,
      message: 'HLS video URL fetched successfully',
      data: {
        hlsUrl: hlsUrl,
        videoId: videoId,
        title: videoData.system_metadata?.filename || 'Unknown Video',
        duration: videoData.system_metadata?.duration || 0,
        createdAt: videoData.created_at,
        metadata: videoData
      }
    });

  } catch (error) {
    console.error('Error in fetch-hls-video API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Fetch HLS video endpoint - use POST with videoId to get HLS URL',
      example: {
        method: 'POST',
        body: {
          videoId: 'your_video_id_here'
        }
      }
    },
    { status: 200 }
  );
} 
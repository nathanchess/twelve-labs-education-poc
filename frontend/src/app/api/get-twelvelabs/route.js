import { NextResponse } from 'next/server';

export async function POST(request) {

    try {

        const body = await request.json();
        const { videoId } = body;

        console.log(videoId)

        if (!videoId) {
            return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
        }

        const retrievalURL = `https://api.twelvelabs.io/v1.3/indexes/${process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID}/videos/${videoId}?transcription=true`

        const options = {
            method: 'GET',
            headers: {
                'x-api-key': process.env.TWELVE_LABS_API_KEY
            }
        }

        const retrieveVideoResponse = await fetch(retrievalURL, options);

        if (!retrieveVideoResponse.ok) {
            console.error('here')
            return NextResponse.json({
                error: 'Failed to fetch video file from TwelveLabs',
            }, { status: 500 });
        }

        const result = await retrieveVideoResponse.json();

        return NextResponse.json({
            success: true,
            data: result
        })

    } catch (error) {
        console.error(error)
        console.error(error.message)
        return NextResponse.json({
            error: 'Failed to fetch file from TwelveLabs',
            details: error.message
        }, { status: 500 });
    }
}
import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
 
export async function POST(request) {
  const body = (await request.json());
 
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('blob upload completed', blob, tokenPayload);
        try {
        } catch (error) {
          throw new Error('Could not update user');
        }
      },
    });
 
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error).message },
      { status: 400 },
    );
  }
}
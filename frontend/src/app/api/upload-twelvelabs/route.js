import { NextResponse } from 'next/server';

export async function POST(request) {

    try {
      const url = 'https://api.twelvelabs.io/v1.3/tasks';

      const formData = await request.formData();

      console.log(formData)

      const options = {
        method: 'POST', 
        headers: {
          'x-api-key': process.env.TWELVE_LABS_API_KEY
        },
        body: formData
      }

      const response = await fetch(url, options);
      const data = await response.json();

      console.log(data)
      
      const retrieveVideoIndexTaskURL = `${url}/${data._id}`;
      const retrieveVideoIndexTaskOptions = {
        method: 'GET',
        headers: {
          'x-api-key': process.env.TWELVE_LABS_API_KEY
        }
      }

      while (true) {
        const retrieveVideoIndexTaskResponse = await fetch(retrieveVideoIndexTaskURL, retrieveVideoIndexTaskOptions);
        const retrieveVideoIndexTaskData = await retrieveVideoIndexTaskResponse.json();

        const video_indexing_status = retrieveVideoIndexTaskData.status;
        const hls_status = retrieveVideoIndexTaskData.hls.status;

        console.log(video_indexing_status, hls_status)

        if (video_indexing_status == 'ready' && hls_status == 'COMPLETE') {
          console.log(`TwelveLabs Video Upload Complete: ${data.video_id}`)
          return NextResponse.json({
            success: true,
            data: data
          })
        } else if (video_indexing_status == 'ERROR') {
            return NextResponse.json({
                error: 'Failed to upload file to TwelveLabs',
            }, { status: 500 });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      return NextResponse.json({
            error: 'Failed to upload file to TwelveLabs',
            details: error.message
        }, { status: 500 });
    }
}
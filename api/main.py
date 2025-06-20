from providers import TwelveLabsHandler
from helpers import DBHandler

import json
import asyncio
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS, cross_origin

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

@app.route('/upload_video', methods=['POST'])
@cross_origin()
def upload_video():

    """
    
    Uploads metadata regarding video to DynamoDB and creates an empty row for metadata.

    Each row will contain UID of each video in their respective providers and metadata regarding AI inference outputs from each provider.
    
    """

    logger.info("=== Starting upload_video endpoint ===")
    
    try:
        logger.info("Parsing request data...")
        data = request.get_json()
        logger.info(f"Request data received: {data}")

        if not data:
            logger.error("No JSON data received in request")
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400

        logger.info("Initializing DBHandler...")
        db_handler = DBHandler()
        
        twelve_labs_video_id = data.get('twelve_labs_video_id')
        logger.info(f"Twelve Labs video ID: {twelve_labs_video_id}")
        
        if not twelve_labs_video_id:
            logger.error("No twelve_labs_video_id provided in request")
            return jsonify({
                'status': 'error',
                'message': 'twelve_labs_video_id is required'
            }), 400

        logger.info("Calling upload_video_ids...")
        result = db_handler.upload_video_ids(twelve_labs_video_id=twelve_labs_video_id)
        logger.info(f"Upload result: {result}")
        
        logger.info("=== upload_video endpoint completed successfully ===")
        
    except Exception as e:
        
        logger.error(f"=== Error in upload_video endpoint: {str(e)} ===")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

    return jsonify({
        'status': 'success',
        'message': 'Video uploaded successfully'
    }), 200

@app.route('/cached_analysis', methods=['POST'])
@cross_origin()
def cached_analysis():
    
    """
    Returns cached analysis for each given provider for common queries.
    This includes:
    1. TwelveLabs: Gist (Title, Hashtag, Topics)
    2. Google Gemini:
    3. AWS Nova:
    
    """

    logger.info("=== Starting cached_analysis endpoint ===")
    
    try:
        data = request.json
        logger.info(f"Request data received: {data}")

        twelve_labs_video_id = data.get('twelve_labs_video_id')
        logger.info(f"Twelve Labs video ID: {twelve_labs_video_id}")

        if not twelve_labs_video_id:
            logger.error("No twelve_labs_video_id provided in request")
            return jsonify({
                'statusCode': 400,
                'message': 'twelve_labs_video_id is required'
            }), 400

        logger.info("Initializing TwelveLabsHandler...")
        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        logger.info("Generating gist...")
        gist_result = twelvelabs_provider.generate_gist()
        logger.info(f"Gist result: {gist_result}")

        logger.info("=== cached_analysis endpoint completed successfully ===")

        return jsonify({
            'statusCode': 200,
            'message': 'Cached analysis retrieved successfully',
            'data': {
                'twelve_labs': gist_result
            }
        })

    except Exception as e:
        logger.error(f"=== Error in cached_analysis endpoint: {str(e)} ===")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")

        return jsonify({
            'statusCode': 500,
            'message': str(e)
        }), 500

@app.route('/run_analysis', methods=['GET', 'POST'])
@cross_origin()
def run_analysis():

    """
    
    Calls each provider's analysis function asynchronously. 
    Each provider will return a dictionary and upload respective metadata to DynamoDB.

    Returns a dictionary with the following keys:
    - 'status': 'success' or 'error'
    - 'message': 'Analysis run successfully' or error message
    - 'data': dictionary with provider names as keys and their respective analysis results as values
    
    """

    try:
        # Handle both GET and POST requests
        if request.method == 'GET':
            twelve_labs_video_id = request.args.get('video_id')
        else:  # POST
            data = request.json
            twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return jsonify({
                'status': 'error',
                'message': 'video_id/twelve_labs_video_id is required'
            }), 400

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        logger.info("Running analysis...")
        
        def generate():
            try:
                async def async_generate():
                    response = twelvelabs_provider.stream_student_lecture_analysis()
                    async for chunk in response:
                        # Format as Server-Sent Event
                        yield f"data: {json.dumps(chunk)}\n\n"
                
                # Run the async generator in the sync context
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    async_gen = async_generate()
                    while True:
                        try:
                            chunk = loop.run_until_complete(async_gen.__anext__())
                            yield chunk
                        except StopAsyncIteration:
                            break
                finally:
                    loop.close()
                    
            except Exception as e:
                error_data = {
                    'type': 'error',
                    'chunk': None,
                    'status': 'error',
                    'error': str(e)
                }
                yield f"data: {json.dumps(error_data)}\n\n"

        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        )

    except Exception as e:
        logger.error(f"=== Error in run_analysis endpoint: {str(e)} ===")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == "__main__":

    app.run(debug=True)
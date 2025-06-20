from providers import TwelveLabsHandler
from helpers import DBHandler

import json
import asyncio
import logging
from flask import Flask, request, jsonify
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

@app.route('/run_analysis', methods=['POST'])
@cross_origin()
async def run_analysis():

    """
    
    Calls each provider's analysis function asynchronously. 
    Each provider will return a dictionary and upload respective metadata to DynamoDB.

    Returns a dictionary with the following keys:
    - 'status': 'success' or 'error'
    - 'message': 'Analysis run successfully' or error message
    - 'data': dictionary with provider names as keys and their respective analysis results as values
    
    """

    result_queue = asyncio.Queue()

    twelve_labs_handler = TwelveLabsHandler(twelve_labs_video_id="685445bbd1abad44eba827ca")

    tasks = [
        asyncio.create_task(twelve_labs_handler.generate_gist())
    ]

    completed_tasks, total_tasks = 0, len(tasks) 

if __name__ == "__main__":

    app.run(debug=True)
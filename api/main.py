from providers import TwelveLabsHandler
from helpers import DBHandler

import json
import asyncio
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS, cross_origin
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
app.secret_key = os.urandom(24)

@app.route('/upload_video', methods=['POST'])
@cross_origin()
def upload_video():

    """
    
    Uploads metadata regarding video to DynamoDB and creates an empty row for metadata.

    Each row will contain UID of each video in their respective providers and metadata regarding AI inference outputs from each provider.
    
    """
    
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400

        db_handler = DBHandler()
        
        twelve_labs_video_id = data.get('twelve_labs_video_id')
        
        if not twelve_labs_video_id:
            return jsonify({
                'status': 'error',
                'message': 'twelve_labs_video_id is required'
            }), 400

        result = db_handler.upload_video_ids(twelve_labs_video_id=twelve_labs_video_id)
        
    except Exception as e:
        
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
    
    try:
        data = request.json
        twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return jsonify({
                'statusCode': 400,
                'message': 'twelve_labs_video_id is required'
            }), 400

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)
        gist_result = twelvelabs_provider.generate_gist()

        return jsonify({
            'statusCode': 200,
            'message': 'Cached analysis retrieved successfully',
            'data': {
                'twelve_labs': gist_result
            }
        })

    except Exception as e:

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
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/generate_chapters', methods=['POST'])
@cross_origin()
def generate_chapters():
    
    """
    Generates chapters for a video.

    Returns a dictionary with the following keys:
    - 'status': 'success' or 'error'
    - 'message': 'Chapters generated successfully' or error message
    - 'data': dictionary with provider names as keys and their respective analysis results as values
    
    """

    try:

        data = request.json
        twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return jsonify({
                'status': 'error',
                'message': 'twelve_labs_video_id is required'
            }), 400
        
        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)
        chapters = twelvelabs_provider.generate_chapters()

        return jsonify({
            'status': 'success',
            'message': 'Chapters generated successfully',
            'data': chapters
        }), 200
    
    except Exception as e:

        print(f"Error in generate_chapters endpoint: {str(e)}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    
@app.route('/generate_pacing_recommendations', methods=['POST'])
@cross_origin()
def generate_pacing_recommendations():

    """
    Generates pacing recommendations for a video.
    """

    try:

        data = request.json
        twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return jsonify({
                'status': 'error',
                'message': 'twelve_labs_video_id is required'
            }), 400

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        pacing_recommendations = twelvelabs_provider.generate_pacing_recommendations()

        return jsonify({
            'status': 'success',
            'message': 'Pacing recommendations generated successfully',
            'data': pacing_recommendations
        }), 200
    
    except Exception as e:

        print(f"Error in generate_pacing_recommendations endpoint: {str(e)}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    
@app.route('/generate_key_takeaways', methods=['POST'])
@cross_origin()
def generate_key_takeaways():

    """
    Generates key takeaways for a video.
    """

    try:

        data = request.json
        twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return jsonify({
                'status': 'error',
                'message': 'twelve_labs_video_id is required'
            }), 400
        

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        key_takeaways = twelvelabs_provider.generate_key_takeaways()

        return jsonify({
            'status': 'success',
            'message': 'Key takeaways generated successfully',
            'data': key_takeaways
        }), 200
    
    except Exception as e:

        print(f"Error in generate_key_takeaways endpoint: {str(e)}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/generate_quiz_questions', methods=['POST'])
@cross_origin()
def generate_quiz_questions():

    """
    Generates quiz questions for a video.
    """

    try:

        data = request.json
        twelve_labs_video_id = data.get('twelve_labs_video_id')
        chapters = data.get('chapters')

        if not twelve_labs_video_id:
            return jsonify({
                'status': 'error',
                'message': 'twelve_labs_video_id is required'
            }), 400

        if not chapters:
            return jsonify({
                'status': 'error',
                'message': 'chapters is required'
            }), 400

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        quiz_questions = twelvelabs_provider.generate_quiz_questions(chapters)

        return jsonify({
            'status': 'success',
            'message': 'Quiz questions generated successfully',
            'data': quiz_questions
        }), 200
    
    except Exception as e:

        print(f"Error in generate_quiz_questions endpoint: {e}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    
@app.route('/publish_course', methods=['POST'])
@cross_origin()
def publish_course():

    """
    Publishes a course to the database.
    """

    try:

        data = request.json

        if not data:
            return jsonify({
                'status': 'error',
                'message': 'No JSON data received'
            }), 400

        db_handler = DBHandler()

        video_id = data.get('video_id')
        title = data.get('title')
        chapters = data.get('chapters')
        quiz_questions = data.get('quiz_questions')
        key_takeaways = data.get('key_takeaways')
        pacing_recommendations = data.get('pacing_recommendations')
        summary = data.get('summary')

        if not video_id or not title or not chapters or not quiz_questions or not key_takeaways or not pacing_recommendations or not summary:
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields'
            }), 400

        result = db_handler.upload_course_metadata(video_id=video_id, title=title, chapters=chapters, quiz_questions=quiz_questions, key_takeaways=key_takeaways, pacing_recommendations=pacing_recommendations, summary=summary)

        return jsonify({
            'status': 'success',
            'message': 'Course published successfully'
        }), 200

    except Exception as e:

        print(f"Error in publish_course endpoint: {e}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/get_published_courses', methods=['GET'])
@cross_origin()
def get_published_courses():

    """
    Retrieves all published courses from the database.
    """

    try:

        db_handler = DBHandler()
        courses = db_handler.get_published_courses()

        return jsonify({
            'status': 'success',
            'message': 'Published courses retrieved successfully',
            'data': courses
        }), 200

    except Exception as e:

        print(f"Error in get_published_courses endpoint: {e}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    
@app.route('/fetch_course_metadata', methods=['POST'])
@cross_origin()
def fetch_course_metadata():

    """
    Fetches course metadata for a given video ID from the database.
    """

    try:

        data = request.json
        video_id = data.get('video_id')

        if not video_id:
            return jsonify({
                'status': 'error',
                'message': 'video_id is required'
            }), 400
        
        db_handler = DBHandler()
        course_metadata = db_handler.fetch_course_metadata(video_id=video_id)

        return jsonify({
            'status': 'success',
            'message': 'Course metadata fetched successfully',
            'data': course_metadata
        }), 200
    
    except ValueError as e:

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 404
    
    except Exception as e:

        print(f"Error in fetch_course_metadata endpoint: {e}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == "__main__":

    app.run(debug=True) 
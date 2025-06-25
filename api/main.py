from decimal import Decimal
from providers import TwelveLabsHandler
from helpers import DBHandler

import json
import asyncio
import logging
import os
from starlette.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

from decimal import Decimal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper Functions

def convert_decimals_for_json(data) -> any:
    
    """
    Recursively convert Decimal objects to strings to make data JSON serializable.
    
    Args:
        data: Any data structure (dict, list, or primitive type)
        
    Returns:
        The same data structure with all Decimal objects converted to strings
    """
    
    def recursive_convert(obj):
        
        if isinstance(obj, Decimal):
            return str(obj)
        elif isinstance(obj, dict):
            return {key: recursive_convert(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [recursive_convert(item) for item in obj]
        else:
            return obj
    
    return recursive_convert(data)

@app.post('/upload_video')
async def upload_video(request: Request):

    """
    
    Uploads metadata regarding video to DynamoDB and creates an empty row for metadata.

    Each row will contain UID of each video in their respective providers and metadata regarding AI inference outputs from each provider.
    
    """
    
    try:
        data = await request.json()

        if not data:
            return JSONResponse({
                'status': 'error',
                'message': 'No JSON data received'
            }, status_code=400)

        db_handler = DBHandler()
        
        twelve_labs_video_id = data.get('twelve_labs_video_id')
        
        if not twelve_labs_video_id:
            return JSONResponse({
                'status': 'error',
                'message': 'twelve_labs_video_id is required'
            }, status_code=400)

        result = db_handler.upload_video_ids(twelve_labs_video_id=twelve_labs_video_id)
        
    except Exception as e:
        
        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)

    return JSONResponse({
        'status': 'success',
        'message': 'Video uploaded successfully'
    }, status_code=200)

@app.post('/cached_analysis')
async def cached_analysis(request: Request):
    
    """
    Returns cached analysis for each given provider for common queries.
    This includes:
    1. TwelveLabs: Gist (Title, Hashtag, Topics)
    2. Google Gemini:
    3. AWS Nova:
    
    """
    
    try:
        data = await request.json()
        twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return JSONResponse({
                'statusCode': 400,
                'message': 'twelve_labs_video_id is required'
            }, status_code=400)

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)
        gist_result = twelvelabs_provider.generate_gist()

        return JSONResponse({
            'statusCode': 200,
            'message': 'Cached analysis retrieved successfully',
            'data': {
                'twelve_labs': gist_result
            }
        }, status_code=200)

    except Exception as e:

        return JSONResponse({
            'statusCode': 500,
            'message': str(e)
        }, status_code=500)

@app.get('/run_analysis')
@app.post('/run_analysis')
async def run_analysis(request: Request):

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
            twelve_labs_video_id = request.query_params.get('video_id')
        else:  # POST
            data = await request.json()
            twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return JSONResponse({
                'status': 'error',
                'type': 'student_lecture_analysis',
                'message': 'video_id/twelve_labs_video_id is required'
            }, status_code=400)

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        def generate():
            try:
                async def async_generate():
                    response = twelvelabs_provider.stream_student_lecture_analysis()
                    async for chunk in response:
                        yield f"data: {json.dumps(chunk)}\n\n"
            
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
                    'type': 'student_lecture_analysis',
                    'chunk': None,
                    'status': 'error',
                    'error': str(e)
                }
                yield f"data: {json.dumps(error_data)}\n\n"

        return StreamingResponse(
            generate(),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        )

    except Exception as e:
        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)

@app.get('/generate_chapters')
@app.post('/generate_chapters')
#@cross_origin()
async def generate_chapters(request: Request):
    
    """
    Generates chapters for a video.

    Returns a dictionary with the following keys:
    - 'status': 'success' or 'error'
    - 'message': 'Chapters generated successfully' or error message
    - 'data': dictionary with provider names as keys and their respective analysis results as values
    
    """

    logger.info('Generating chapters')

    try:

        if request.method == 'GET':
            twelve_labs_video_id = request.query_params.get('video_id')
        else:
            data = await request.json()
            twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return {
                'status': 'error',
                'type': 'chapters',
                'message': 'twelve_labs_video_id is required'
            }
        
        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)
        chapters = await twelvelabs_provider.generate_chapters()

        return {
            'status': 'success',
            'type': 'chapters',
            'message': 'Chapters generated successfully',
            'data': chapters
        }
    
    except Exception as e:

        print(f"Error in generate_chapters endpoint: {str(e)}")

        return {
            'status': 'error',
            'type': 'chapters',
            'message': str(e)
        }
    
@app.get('/generate_pacing_recommendations')
@app.post('/generate_pacing_recommendations')
#@cross_origin()
async def generate_pacing_recommendations(request: Request):

    """
    Generates pacing recommendations for a video.
    """

    logger.info('Generating pacing recommendations')

    try:

        if request.method == 'GET':
            twelve_labs_video_id = request.query_params.get('video_id')
        else:
            data = await request.json()
            twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return {
                'status': 'error',
                'type': 'pacing_recommendations',
                'message': 'twelve_labs_video_id is required'
            }

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        pacing_recommendations = await twelvelabs_provider.generate_pacing_recommendations()

        return {
            'status': 'success',
            'type': 'pacing_recommendations',
            'message': 'Pacing recommendations generated successfully',
            'data': pacing_recommendations
        }
    
    except Exception as e:

        print(f"Error in generate_pacing_recommendations endpoint: {str(e)}")

        return {
            'status': 'error',
            'type': 'pacing_recommendations',
            'message': str(e)
        }
    
@app.get('/generate_key_takeaways')
@app.post('/generate_key_takeaways')
#@cross_origin()
async def generate_key_takeaways(request: Request):

    """
    Generates key takeaways for a video.
    """

    logger.info('Generating key takeaways')

    try:

        if request.method == 'GET':
            twelve_labs_video_id = request.query_params.get('video_id')
        else:
            data = await request.json()
            twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return {
                'status': 'error',
                'type': 'key_takeaways',
                'message': 'twelve_labs_video_id is required'
            }
        

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        key_takeaways = await twelvelabs_provider.generate_key_takeaways()

        return {
            'status': 'success',
            'type': 'key_takeaways',
            'message': 'Key takeaways generated successfully',
            'data': key_takeaways
        }
    
    except Exception as e:

        print(f"Error in generate_key_takeaways endpoint: {str(e)}")

        return {
            'status': 'error',
            'type': 'key_takeaways',
            'message': str(e)
        }

@app.get('/generate_quiz_questions')
@app.post('/generate_quiz_questions')
#@cross_origin()
async def generate_quiz_questions(request: Request):

    """
    Generates quiz questions for a video.
    """

    logger.info('Generating quiz questions')

    try:

        if request.method == 'GET':
            twelve_labs_video_id = request.query_params.get('video_id')
            chapters = request.query_params.get('chapters')
        else:
            data = await request.json()
            twelve_labs_video_id = data.get('twelve_labs_video_id')
            chapters = data.get('chapters')

        if not twelve_labs_video_id:
            return {
                'status': 'error',
                'type': 'quiz_questions',
                'message': 'twelve_labs_video_id is required'
            }

        if not chapters:
            return {
                'status': 'error',
                'type': 'quiz_questions',
                'message': 'chapters is required'
            }

        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        quiz_questions = await twelvelabs_provider.generate_quiz_questions(chapters)

        return {
            'status': 'success',
            'type': 'quiz_questions',
            'message': 'Quiz questions generated successfully',
            'data': quiz_questions
        }
    
    except Exception as e:

        print(f"Error in generate_quiz_questions endpoint: {e}")

        return {
            'status': 'error',
            'type': 'quiz_questions',
            'message': str(e)
        }
    
@app.get('/generate_engagement')
@app.post('/generate_engagement')
#@cross_origin()
async def generate_engagement(request: Request):
    
    """
    Generates engagement for a video.
    """

    logger.info('Generating engagement')
    
    try:

        if request.method == 'GET':
            twelve_labs_video_id = request.query_params.get('video_id')
        else:
            data = await request.json()
            twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return {
                'status': 'error',
                'type': 'engagement',
                'message': 'twelve_labs_video_id is required'
            }
        
        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        engagement = await twelvelabs_provider.generate_engagement()

        return {
            'status': 'success',
            'type': 'engagement',
            'message': 'Engagement generated successfully',
            'data': engagement
        }
    
    except Exception as e:
        
        print(f"Error in generate_engagement endpoint: {e}")
        
        return {
            'status': 'error',
            'type': 'engagement',
            'message': str(e)
        }
    
@app.get('/generate_multimodal_transcript')
@app.post('/generate_multimodal_transcript')
#@cross_origin()
async def generate_multimodal_transcript(request: Request):

    """
    Generates a multimodal transcript of a video.
    """

    logger.info('Generating multimodal transcript')

    try:

        if request.method == 'GET':
            twelve_labs_video_id = request.query_params.get('video_id')
        else:
            data = await request.json()
            twelve_labs_video_id = data.get('twelve_labs_video_id')

        if not twelve_labs_video_id:
            return {
                'status': 'error',
                'type': 'multimodal_transcript',
                'message': 'twelve_labs_video_id is required'
            }
        
        twelvelabs_provider = TwelveLabsHandler(twelve_labs_video_id=twelve_labs_video_id)

        transcript = await twelvelabs_provider.generate_multimodal_transcript()

        return {
            'status': 'success',
            'type': 'multimodal_transcript',
            'message': 'Multimodal transcript generated successfully',
            'data': transcript
        }
    
    except Exception as e:
        
        print(f"Error in generate_multimodal_transcript endpoint: {e}")
        
        return {
            'status': 'error',
            'type': 'multimodal_transcript',
            'message': str(e)
        }

@app.post('/publish_course')
async def publish_course(request: Request):

    """
    Publishes a course to the database.
    """

    try:

        data = await request.json()

        if not data:
            return JSONResponse({
                'status': 'error',
                'message': 'No JSON data received'
            }, status_code=400)

        db_handler = DBHandler()

        video_id = data.get('video_id')
        title = data.get('title')
        chapters = data.get('chapters')
        quiz_questions = data.get('quiz_questions')
        key_takeaways = data.get('key_takeaways')
        pacing_recommendations = data.get('pacing_recommendations')
        summary = data.get('summary')
        engagement = data.get('engagement')
        transcript = data.get('transcript')

        print(f"Publishing course with data: {data}")

        if not video_id or not title or not chapters or not quiz_questions or not key_takeaways or not pacing_recommendations or not summary or not engagement or not transcript:
            return JSONResponse({
                'status': 'error',
                'message': 'Missing required fields'
            }, status_code=400)

        result = db_handler.upload_course_metadata(video_id=video_id, title=title, chapters=chapters, quiz_questions=quiz_questions, key_takeaways=key_takeaways, pacing_recommendations=pacing_recommendations, summary=summary, engagement=engagement, transcript=transcript)

        return JSONResponse({
            'status': 'success',
            'message': 'Course published successfully'
        }, status_code=200)

    except Exception as e:

        print(f"Error in publish_course endpoint: {e}")

        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)

@app.get('/get_published_courses')
@app.post('/get_published_courses')
async def get_published_courses(request: Request):

    """
    Retrieves all published courses from the database.
    """

    try:

        db_handler = DBHandler()
        courses = db_handler.get_published_courses()

        courses = convert_decimals_for_json(courses)

        return JSONResponse({
            'status': 'success',
            'message': 'Published courses retrieved successfully',
            'data': courses
        }, status_code=200)

    except Exception as e:

        print(f"Error in get_published_courses endpoint: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()

        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)
    
@app.get('/fetch_course_metadata')
@app.post('/fetch_course_metadata')
async def fetch_course_metadata(request: Request):

    """
    Fetches course metadata for a given video ID from the database.
    """

    try:

        data = await request.json()
        video_id = data.get('video_id')

        if not video_id:
            return JSONResponse({
                'status': 'error',
                'message': 'video_id is required'
            }, status_code=400)
        
        db_handler = DBHandler()
        course_metadata = db_handler.fetch_course_metadata(video_id=video_id)

        course_metadata = convert_decimals_for_json(course_metadata)

        return JSONResponse({
            'status': 'success',
            'message': 'Course metadata fetched successfully',
            'data': course_metadata
        }, status_code=200)
    
    except ValueError as e:

        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=404)
    
    except Exception as e:

        print(f"Error in fetch_course_metadata endpoint: {e}")

        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)

@app.post('/save_student_reaction')
async def save_student_reaction(request: Request):
    """
    Saves a student reaction to the database.
    """
    try:
        data = await request.json()
        video_id = data.get('video_id')
        reaction = data.get('reaction')

        if not video_id or not reaction:
            return JSONResponse({
                'status': 'error',
                'message': 'video_id and reaction are required'
            }, status_code=400)

        db_handler = DBHandler()
        
        # Save the reaction to the database
        result = db_handler.save_student_reaction(video_id=video_id, reaction=reaction)

        return JSONResponse({
            'status': 'success',
            'message': 'Reaction saved successfully'
        }, status_code=200)

    except Exception as e:
        print(f"Error in save_student_reaction endpoint: {e}")
        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)

@app.post('/get_student_reactions')
async def get_student_reactions(request: Request):
    """
    Retrieves student reactions for a given video ID from the database.
    """
    try:
        data = await request.json()
        video_id = data.get('video_id')

        if not data:
            return JSONResponse({
                'status': 'error',
                'message': 'No JSON data received'
            }, status_code=400)
        
        if not video_id:
            return JSONResponse({
                'status': 'error',
                'message': 'video_id is required'
            }, status_code=400)
        
        db_handler = DBHandler()
        reactions = db_handler.get_student_reactions(video_id)

        reactions = convert_decimals_for_json(reactions)
        
        return JSONResponse({
            'status': 'success',
            'reactions': reactions
        }, status_code=200)

    except Exception as e:
        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)

@app.post('/save_wrong_answer')
async def save_wrong_answer(request: Request):
    """
    Saves a wrong answer to the database.
    """
    try:
        data = await request.json()
        video_id = data.get('video_id')
        wrong_answer = data.get('wrong_answer')
        student_name = data.get('student_name')

        if not data:
            return JSONResponse({
                'status': 'error',
                'message': 'No JSON data received'
            }, status_code=400)
        
        if not video_id or not wrong_answer or not student_name:
            return JSONResponse({
                'status': 'error',
                'message': 'video_id, wrong_answer, and student_name are required'
            }, status_code=400)
        
        db_handler = DBHandler()
        result = db_handler.save_wrong_answer(student_name, video_id, wrong_answer)
        
        return JSONResponse({
            'status': 'success',
            'message': 'Wrong answer saved successfully'
        }, status_code=200)

    except Exception as e:
        return JSONResponse({
            'status': 'error',
            'message': str(e)
        }, status_code=500)

if __name__ == "__main__":

    app.run(debug=True) 
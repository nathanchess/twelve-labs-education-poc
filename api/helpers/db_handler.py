import boto3
import os
import logging
import time
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class DBHandler:

    def __init__(self):
        logger.info("Initializing DBHandler...")
        try:
            self.dynamodb = boto3.resource('dynamodb')
            logger.info("DynamoDB resource created successfully")
        except Exception as e:
            logger.error(f"Error creating DynamoDB resource: {str(e)}")
            raise

    def upload_video_ids(self, twelve_labs_video_id: str):

        """
        
        Uploads video IDs to DynamoDB.

        Each row will contain UID of each video in their respective providers and create empty rows for metadata for future AI inference outputs from each provider.

        """

        try:
            table_name = os.getenv('DYNAMODB_CONTENT_TABLE_NAME')
            
            if not table_name:
                logger.error("DYNAMODB_TABLE_NAME environment variable not set")
                raise Exception("DYNAMODB_TABLE_NAME environment variable not set")

            table = self.dynamodb.Table(table_name)
            logger.info("DynamoDB table reference obtained")

            # Fix: The Item should be a simple dictionary, not nested with type annotations
            item = {
                'video_id': twelve_labs_video_id,
                'created_at': boto3.dynamodb.types.Decimal(str(int(time.time()))),
            }
            
            logger.info(f"Preparing to upload item: {item}")

            response = table.put_item(Item=item)
            logger.info(f"DynamoDB put_item response: {response}")

            return response
        
        except Exception as e:
            logger.error(f"=== Error in upload_video_ids: {str(e)} ===")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise Exception(f"Error uploading video IDs: {str(e)}")
        
    def upload_course_metadata(self, video_id: str, title: str, chapters: list, quiz_questions: list, key_takeaways: list, pacing_recommendations: list, summary: str):
        
        """
        
        Uploads course metadata to DynamoDB.
        
        """

        try:

            table_name = os.getenv('DYNAMODB_CONTENT_TABLE_NAME')

            if not table_name:
                raise Exception("DYNAMODB_TABLE_NAME environment variable not set")

            table = self.dynamodb.Table(table_name)
            item = {
                'video_id': video_id,
                'summary': summary,
                'created_at': boto3.dynamodb.types.Decimal(str(int(time.time()))),
                'title': title,
                'chapters': chapters,
                'quiz_questions': quiz_questions,
                'key_takeaways': key_takeaways,
                'pacing_recommendations': pacing_recommendations
            }

            response = table.put_item(Item=item)

            return response
        
        except Exception as e:
            logger.error(f"=== Error in upload_course_metadata: {str(e)} ===")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise Exception(f"Error uploading course metadata: {str(e)}")

    def get_published_courses(self):
        
        """
        
        Retrieves all published courses from DynamoDB.
        
        """

        try:

            table_name = os.getenv('DYNAMODB_CONTENT_TABLE_NAME')

            if not table_name:
                raise Exception("DYNAMODB_CONTENT_TABLE_NAME environment variable not set")

            table = self.dynamodb.Table(table_name)
            logger.info("DynamoDB table reference obtained for getting published courses")

            # Scan the table to get all items
            response = table.scan()
            items = response.get('Items', [])

            # Continue scanning if there are more items
            while 'LastEvaluatedKey' in response:
                response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
                items.extend(response.get('Items', []))

            logger.info(f"Retrieved {len(items)} published courses from DynamoDB")

            return items
        
        except Exception as e:
            logger.error(f"=== Error in get_published_courses: {str(e)} ===")
            raise e
        
    def fetch_course_metadata(self, video_id: str):

        """

        Fetches course metadata for a given video ID from DynamoDB.

        """

        try:

            table_name = os.getenv('DYNAMODB_CONTENT_TABLE_NAME')

            if not table_name:
                raise Exception("DYNAMODB_CONTENT_TABLE_NAME environment variable not set")

            table = self.dynamodb.Table(table_name)
            logger.info("DynamoDB table reference obtained for fetching course metadata")

            response = table.get_item(Key={'video_id': video_id})
            item = response.get('Item', {})

            if not item:
                raise ValueError(f"No course metadata found for video ID: {video_id}")

            logger.info(f"Successfully fetched course metadata for video ID: {video_id}")

            return item
        
        except Exception as e:

            logger.error(f"=== Error in fetch_course_metadata: {str(e)} ===")
            raise e
        

__all__ = ['DBHandler']
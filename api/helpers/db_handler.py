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

        logger.info(f"=== Starting upload_video_ids for video ID: {twelve_labs_video_id} ===")

        try:
            table_name = os.getenv('DYNAMODB_CONTENT_TABLE_NAME')
            logger.info(f"Using DynamoDB table: {table_name}")
            
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

__all__ = ['DBHandler']
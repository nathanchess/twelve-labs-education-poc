import pydantic
import boto3
import instructor

class LectureBuilderAgent:

    def __init__(self):

        self.bedrock_client = boto3.client('bedrock-runtime')
        self.instructor_client = instructor.from_bedrock(self.bedrock_client)
        self.bedrock_model_id = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'

        self.reformat_count = 0

    def reformat_text(self, text: str, data_schema: pydantic.BaseModel) -> str:

        self.reformat_count += 1

        try:

            response = self.instructor_client.chat.completions.create(
                model=self.bedrock_model_id,
                messages=[
                    {'role': 'user', 'content': f'Reformat the following text to match the following data schema: {data_schema.model_json_schema()}. Change the tone to be instructional towards a student trying to learn. The text is: {text}'}
                ],
                response_model=data_schema
            )
            
            return response

        except Exception as e:

            raise Exception(f"Error reformatting text: {str(e)}")

__all__ = ['LectureBuilderAgent']
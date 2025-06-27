import pydantic
import boto3
import instructor

from .prompts import study_recommendations_prompt, concept_mastery_prompt, course_analysis_prompt
from .data_schema import StudyRecommendationsSchema, ConceptMasterySchema, CourseAnalysisSchema

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
        
class EvaluationAgent:

    """ 
    
    This agent is responsible for evaluating the performance of students in a given video.

    It will have tools that allows it to:
    1. Search the internet to reference supplemental information and content
    2. Generate a report of the student's performance
    3. Regenerate new practice questions targeting student weaknesses.
    4. Calculate student quiz performance and give a score.

    """

    def __init__(self, video_metadata: dict):

        self.bedrock_client = boto3.client('bedrock-runtime')
        self.instructor_client = instructor.from_bedrock(self.bedrock_client)
        self.bedrock_model_id = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'

        self.video_metadata = video_metadata

    def generate_quiz_study_recommendations(self, wrong_answers: list):

        try:

            chapters = self.video_metadata['chapters']
            transcript = self.video_metadata['transcript']
            quiz_questions = self.video_metadata['quiz_questions']

            prompt = study_recommendations_prompt.format(
                transcript=transcript,
                chapters=chapters,
                quiz_questions=quiz_questions,
                wrong_answers=wrong_answers
            )

            response = self.instructor_client.chat.completions.create(
                model=self.bedrock_model_id,
                messages=[{'role': 'user', 'content': prompt}],
                response_model=StudyRecommendationsSchema
            )

            return response

        except Exception as e:

            raise Exception(f"Error generating quiz study recommendations: {str(e)}")
        
    def generate_concept_mastery(self, wrong_answers: list):
        
        try:
            
            chapters = self.video_metadata['chapters']
            transcript = self.video_metadata['transcript']
            quiz_questions = self.video_metadata['quiz_questions']

            prompt = concept_mastery_prompt.format(
                transcript=transcript,
                chapters=chapters,
                quiz_questions=quiz_questions,
                wrong_answers=wrong_answers
            )

            response = self.instructor_client.chat.completions.create(
                model=self.bedrock_model_id,
                messages=[{'role': 'user', 'content': prompt}],
                response_model=ConceptMasterySchema
            )

            return response
        
        except Exception as e:

            raise Exception(f"Error generating concept mastery: {str(e)}")


    def calculate_quiz_performance(self, wrong_answers: list):

        try:
        
            total_questions = len(self.video_metadata['quiz_questions'])

            question_by_chapters = {}

            for question in self.video_metadata['quiz_questions']:

                if question['chapter_id'] not in question_by_chapters:
                    question_by_chapters[question['chapter_id']] = []

                question_by_chapters[question['chapter_id']].append(question) 

            accuracy = len(wrong_answers) / total_questions

            study_recommendations = self.generate_quiz_study_recommendations(wrong_answers)
            concept_mastery = self.generate_concept_mastery(wrong_answers)

            student_report = {
                'accuracy': accuracy,
                'total_questions': total_questions,
                'question_by_chapters': question_by_chapters,
                'wrong_answers': wrong_answers,
                'study_recommendations': study_recommendations.model_dump() if hasattr(study_recommendations, 'model_dump') else study_recommendations,
                'chapters': self.video_metadata['chapters'],
                'concept_mastery': concept_mastery.model_dump() if hasattr(concept_mastery, 'model_dump') else concept_mastery
            }

            return student_report

        except Exception as e:

            raise Exception(f"Error calculating quiz performance: {str(e)}")
        
    def generate_course_analysis(self, student_data: dict):
        
        try:
            
            prompt = course_analysis_prompt.format(
                video_metadata=self.video_metadata,
                student_data=student_data
            )
            
            response = self.instructor_client.chat.completions.create(
                model=self.bedrock_model_id,
                messages=[{'role': 'user', 'content': prompt}],
                response_model=CourseAnalysisSchema
            )
            
            return response
        
        except Exception as e:

            raise Exception(f"Error generating course analysis: {str(e)}")

__all__ = ['LectureBuilderAgent', 'EvaluationAgent']
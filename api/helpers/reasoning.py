import pydantic
import boto3
import instructor
import asyncio

import numpy as np
from pytube import YouTube, Search

from twelvelabs import TwelveLabs
import os
from dotenv import load_dotenv

from .db_handler import DBHandler

load_dotenv(override=True)

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

        """
        
        Given the course details and the student's wrong answers, will generate a detailed section on what subtopics the student needs to focus on to improve.
        
        """
        
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

        """
        
        Given the course details and the student's wrong answers, will generate a detailed report of the student's performance and steps to improve personalzied to students.
        
        """

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

        """
        
        Given all student data on a specific course, will generate a detailed analysis of the course according to the student's performance.
        
        """
        
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
        
class VideoSearchAgent:

    def __init__(self):

        self.twelvelabs_client = TwelveLabs(api_key=os.getenv('TWELVE_LABS_API_KEY'))

    def _euclidean_distance(self, embedding1: list, embedding2: list):

        minimum_length = min(len(embedding1), len(embedding2))

        if len(embedding1) != len(embedding2):
            embedding1 = embedding1[:minimum_length]
            embedding2 = embedding2[:minimum_length]
        
        return np.linalg.norm(np.array(embedding1) - np.array(embedding2))
    
    def knn_search(self, comparison_embedding: list, embeddings: dict, k: int):

        try:
            
            distances = {}

            for video_url, video_embedding in embeddings.items():

                distances[video_url] = self._euclidean_distance(comparison_embedding, video_embedding)
            
            return sorted(distances.items(), key=lambda x: x[1])[:k]

        except Exception as e:

            raise Exception(f"Error performing knn search: {str(e)}")

    def query_generation(self, video_id: str):

        try:

            youtube_search_query = self.twelvelabs_client.analyze(video_id=video_id, prompt='Generate a youtube search query for this video. Focus on the content and subtopics of the video, not the title. The query should be short and concise words to find the most relevant videos.')

            return youtube_search_query.data
        
        except Exception as e:

            raise Exception(f"Error generating youtube search query: {str(e)}")

    def youtube_api_search(self, query: str):

        try:

            search_results = Search(query).results
            search_urls = []

            for video in search_results:
                search_urls.append(video.watch_url)

            return search_urls
        
        except Exception as e:

            raise Exception(f"Error searching youtube: {str(e)}")
        
    def generate_new_video_embeddings(self, video_url: str, comparison_embedding: list, video_duration: int):

        try:

            embedding = np.array([])

            task = self.twelvelabs_client.embed.task.create(
                model_name="Marengo-retrieval-2.7",
                video_url=video_url,
                video_start_offset_sec=0,
                video_end_offset_sec=video_duration+1
            )

            def on_embedding_generated(task):
                pass

            status = task.wait_for_done(sleep_interval=2, callback=on_embedding_generated)

            video_embedding = task.retrieve(embedding_option=['visual-text'])

            for segment in video_embedding.video_embedding.segments:
                embedding = np.concatenate([embedding, segment.embeddings_float])

            print(embedding.shape)

            return embedding
        
        except Exception as e:

            raise Exception(f"Error generating new video embeddings: {str(e)}")

    def fetch_related_videos(self, video_id: str):

        try:

            """
            youtube_search_query = self.query_generation(video_id)
            youtube_search_results = self.youtube_api_search(youtube_search_query)

            print("Youtube search query: ", youtube_search_query)
            print("Youtube search results: ", youtube_search_results)
            """

            presigned_urls = DBHandler().fetch_s3_presigned_urls()
            
            video_object = self.twelvelabs_client.index.video.retrieve(index_id=os.getenv('TWELVE_LABS_INDEX_ID'), id=video_id, embedding_option=['visual-text'])
            video_duration = video_object.system_metadata.duration
            video_embedding_segments = video_object.embedding.video_embedding.segments

            combined_embedding = np.array([])

            for segment in video_embedding_segments:
                combined_embedding = np.concatenate([combined_embedding, segment.embeddings_float])

            print(combined_embedding.shape)
            
            
            other_video_embeddings = {}
                
            for video_url in presigned_urls:

                video_embedding = self.generate_new_video_embeddings(video_url, combined_embedding, video_duration)

                other_video_embeddings[video_url] = video_embedding

            knn_results = self.knn_search(combined_embedding, other_video_embeddings, 5)

            print("KNN results: ", knn_results)
            
            return knn_results

        except Exception as e:

            raise Exception(f"Error fetching related videos: {str(e)}")


__all__ = ['LectureBuilderAgent', 'EvaluationAgent', 'VideoSearchAgent']
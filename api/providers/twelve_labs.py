from twelvelabs import TwelveLabs
from helpers import prompts, data_schema, LectureBuilderAgent
from .llm import LLMProvider

import pydantic
import os
import json
import asyncio
from dotenv import load_dotenv

load_dotenv()

class TwelveLabsHandler(LLMProvider):

    def __init__(self, twelve_labs_index_id: str = "", twelve_labs_video_id: str = ""):

        self.twelve_labs_client = TwelveLabs(api_key=os.getenv("TWELVE_LABS_API_KEY"))
        self.reasoning_agent = LectureBuilderAgent()

        self.twelve_labs_index_id = twelve_labs_index_id
        self.twelve_labs_video_id = twelve_labs_video_id
        
        self.indexes = dict()

        # Internal video attributes
        self.title = None
        self.hashtags = None
        self.topics = None
        self.summary = None
        self.key_takeaways = None
        self.pacing_recommendations = None
        self.chapters = None
        self.quiz_questions = None
        self.flashcards = None

    def _list_indexes(self):

        """
        
        Lists all indexes on the TwelveLabs account and populates the indexes list.
        
        """
        
        indexes = self.twelve_labs_client.index.list()
        for index in indexes:
            self.indexes[index.name] = index

        return self.indexes
    
 
    async def _process_coroutine(self, stream_type: str, prompt: str, output_queue: asyncio.Queue):
        
        """
        
        Processes a coroutine and streams the results to the output queue.
        
        """
        
        try:

            coroutine = self.twelve_labs_client.analyze_stream(video_id=self.twelve_labs_video_id, prompt=prompt)

            for chunk in coroutine:

                print(chunk)

                await output_queue.put(json.dumps({
                    "type": stream_type,
                    "content": chunk,
                    'status': 'in_progress'
                }))

            await output_queue.put(json.dumps({
                'type': stream_type,
                'chunk': None,
                'status': 'complete'
            }))

        except Exception as e:
            
            await output_queue.put(json.dumps({
                'type': stream_type,
                'chunk': None,
                'status': 'error',
                'error': str(e)
            }))
        

    async def stream_student_lecture_analysis(self):

        """
        
        Deconstructs the video into a list of frames and streams the results.

        Runs them concurrently using asyncio coroutines and returns the coroutines to be iterated over.
        
        """

        try:

            output_queue = asyncio.Queue()

            summary_coroutine = self._process_coroutine(stream_type='summary', prompt=prompts.summary_prompt, output_queue=output_queue)
            #key_takeaways_coroutine = self._process_coroutine(stream_type='key_takeaways', prompt=prompts.key_takeaways_prompt, output_queue=output_queue)
            #pacing_recommendations_coroutine = self._process_coroutine(stream_type='pacing_recommendations', prompt=prompts.pacing_recommendations_prompt, output_queue=output_queue)
            #chapter_coroutine = self._process_coroutine(stream_type='chapter', prompt=self.chapter_prompt, output_queue=output_queue)

            summary_task = asyncio.create_task(summary_coroutine)
            #key_takeaways_task = asyncio.create_task(key_takeaways_coroutine)
            #chapter_task = asyncio.create_task(chapter_coroutine)

            tasks_to_complete = [summary_task]
            completed_stream_count = 0
            total_streams = len(tasks_to_complete)

            stream_status = {
                'summary': False,
            }

            while completed_stream_count < total_streams:

                while not output_queue.empty():

                    item = await output_queue.get()
                    data = json.loads(item)

                    if data['status'] == 'complete':

                        stream_status[data['type']] = True
                        completed_stream_count += 1

                    yield data

                await asyncio.sleep(0.1)

                done_tasks = []
                for task in tasks_to_complete:

                    if task.done():
                        try:
                            task.result()
                        except Exception as e:
                            if 'summary' in task.get_name():
                                print(f"Error processing summary task: {str(e)}")
                            elif 'chapter' in task.get_name():
                                print(f"Error processing chapter task: {str(e)}")
                        tasks_to_complete.remove(task)
                        done_tasks.append(task)

                if all(stream_status.values()):
                    break

        except Exception as e:

            raise Exception(f"Error deconstructing video: {str(e)}")
        
    async def generate_chapters(self):

        """
        
        Generates chapters for video according to data schema defined.

        If output from TwelveLabs provider cannot be validated against the data schema, it will be reformatted by reasoning model.
        
        """

        try:

            raw_chapters = await asyncio.to_thread(
                self.twelve_labs_client.analyze,
                video_id=self.twelve_labs_video_id,
                prompt=prompts.chapter_prompt
            )
            chapters = data_schema.ChaptersSchema.model_validate_json(raw_chapters)

            self.chapters = chapters

            return chapters
        
        except pydantic.ValidationError as e:

            response = await asyncio.to_thread(
                self.reasoning_agent.reformat_text,
                text=raw_chapters,
                data_schema=data_schema.ChaptersSchema
            )
            self.chapters = response

            return response.model_dump()
        
        except Exception as e:

            raise Exception(f"Error generating chapters: {str(e)}")
        
    async def generate_key_takeaways(self):

        """
        
        Generates key takeaways for the video.
        
        """

        try:

            raw_key_takeaways = await asyncio.to_thread(
                self.twelve_labs_client.analyze,
                video_id=self.twelve_labs_video_id,
                prompt=prompts.key_takeaways_prompt
            )
            key_takeaways = data_schema.KeyTakeawaysSchema.model_validate_json(raw_key_takeaways)

            self.key_takeaways = key_takeaways

            return key_takeaways
        
        except pydantic.ValidationError as e:

            response = await asyncio.to_thread(
                self.reasoning_agent.reformat_text,
                text=raw_key_takeaways,
                data_schema=data_schema.KeyTakeawaysSchema
            )
            self.key_takeaways = response

            return response.model_dump()
        
        except Exception as e:

            raise Exception(f"Error generating key takeaways: {str(e)}")
        
    async def generate_pacing_recommendations(self):

        """
        
        Generates pacing recommendations for the video.
        
        """

        try:

            raw_pacing_recommendations = await asyncio.to_thread(
                self.twelve_labs_client.analyze,
                video_id=self.twelve_labs_video_id,
                prompt=prompts.pacing_recommendations_prompt
            )
            pacing_recommendations = data_schema.PacingRecommendationsSchema.model_validate_json(raw_pacing_recommendations)

            self.pacing_recommendations = pacing_recommendations

            return pacing_recommendations
        
        except pydantic.ValidationError as e:

            response = await asyncio.to_thread(
                self.reasoning_agent.reformat_text,
                text=raw_pacing_recommendations,
                data_schema=data_schema.PacingRecommendationsSchema
            )
            self.pacing_recommendations = response
            
            return response.model_dump()
        
        except Exception as e:
            
            raise Exception(f"Error generating pacing recommendations: {str(e)}")
        
    async def generate_quiz_questions(self, chapters: list):

        """
        
        Generates quiz questions for the video.
        
        """

        print(f"Chapters: {chapters}")

        # Validate that chapters is a list and not empty
        if not chapters or not isinstance(chapters, list) or len(chapters) == 0:
            raise Exception("Chapters must be a non-empty list")

        chapters_string = "\n".join([f"{chapter['title']}: {chapter['summary']}" for chapter in chapters])

        quiz_questions_prompt = prompts.quiz_questions_prompt.format(chapters_string)

        try:

            raw_quiz_questions = await asyncio.to_thread(
                self.twelve_labs_client.analyze,
                video_id=self.twelve_labs_video_id,
                prompt=quiz_questions_prompt
            )
            quiz_questions = data_schema.QuizQuestionsSchema.model_validate_json(raw_quiz_questions)

            self.quiz_questions = quiz_questions

            return quiz_questions
        
        except pydantic.ValidationError as e:
            
            response = await asyncio.to_thread(
                self.reasoning_agent.reformat_text,
                text=raw_quiz_questions,
                data_schema=data_schema.QuizQuestionsSchema
            )
            self.quiz_questions = response

            return response.model_dump()
        
        except Exception as e:

            raise Exception(f"Error generating quiz questions: {e}")
        
    async def generate_engagement(self):

        """

        Generates engagement for the video.
        
        """
        
        try:

            raw_engagement = await asyncio.to_thread(
                self.twelve_labs_client.analyze,
                video_id=self.twelve_labs_video_id,
                prompt=prompts.engagement_prompt
            )
            engagement = data_schema.EngagementListSchema.model_validate_json(raw_engagement)

            self.engagement = engagement

            return engagement
        
        except pydantic.ValidationError as e:

            response = await asyncio.to_thread(
                self.reasoning_agent.reformat_text,
                text=raw_engagement,
                data_schema=data_schema.EngagementListSchema
            )
            self.engagement = response

            return response.model_dump()
        
        except Exception as e:

            raise Exception(f"Error generating engagement: {str(e)}")

    def generate_gist(self):

        """
        
        Generates a gist of the video.
        
        """

        try: 

            gist = self.twelve_labs_client.gist(video_id=self.twelve_labs_video_id, types=['topic', 'hashtag', 'title'])

            title, hashtags, topics = gist.title, gist.hashtags.root, gist.topics.root

            self.title = title
            self.hashtags = hashtags
            self.topics = topics

            return {
                'title': title,
                'hashtags': hashtags,
                'topics': topics
            }

        except Exception as e:

            raise Exception(f"Error generating gist: {str(e)}")
    
__all__ = ["TwelveLabsHandler"]
import pydantic

class SummarySchema(pydantic.BaseModel):
    summary: str

class PacingRecommendation(pydantic.BaseModel):
    start_time: float
    end_time: float
    recommendation: str
    severity: str

class PacingRecommendationsSchema(pydantic.BaseModel):
    recommendations: list[PacingRecommendation]

class KeyTakeawaysSchema(pydantic.BaseModel):
    key_takeaways: list[str]

class ChapterSchema(pydantic.BaseModel):
    title: str
    summary: str
    start_time: float
    end_time: float
    chapter_id: int

class ChaptersSchema(pydantic.BaseModel):
    chapters: list[ChapterSchema]

class QuizQuestion(pydantic.BaseModel):
    question: str
    answer: str
    wrong_answers: list[str]
    chapter_id: int
    answer_explanation: str
    hint: str

class QuizQuestionsSchema(pydantic.BaseModel):
    quiz_questions: list[QuizQuestion]

class Flashcard(pydantic.BaseModel):
    concept: str
    definition: str
    chapter_id: int

class FlashcardsSchema(pydantic.BaseModel):
    flashcards: list[Flashcard]

class EngagementSchema(pydantic.BaseModel):
    emotion: str
    engagement_level: int
    description: str
    reason: str
    timestamp: str

class EngagementListSchema(pydantic.BaseModel):
    engagement: list[EngagementSchema]

class TranscriptSchema(pydantic.BaseModel):
    transcript: str
    
class StudyRecommendation(pydantic.BaseModel):
    priority: str
    time_to_review: str
    recommendation_title: str
    recommendation_description: str
    recommended_chapters: list[int]

class StudyRecommendationsSchema(pydantic.BaseModel):
    study_recommendations: list[StudyRecommendation]

class ConceptMastery(pydantic.BaseModel):
    concept: str
    mastery_level: int
    chapter_title: str
    reasoning: str

class ConceptMasterySchema(pydantic.BaseModel):
    concept_mastery: list[ConceptMastery]

__all__ = ['SummarySchema', 'PacingRecommendationsSchema', 'KeyTakeawaysSchema', 'ChaptersSchema', 'QuizQuestionsSchema', 'FlashcardsSchema', 'EngagementSchema', 'EngagementListSchema']

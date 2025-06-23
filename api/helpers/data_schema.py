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

class QuizQuestionsSchema(pydantic.BaseModel):
    quiz_questions: list[QuizQuestion]

class Flashcard(pydantic.BaseModel):
    concept: str
    definition: str
    chapter_id: int

class FlashcardsSchema(pydantic.BaseModel):
    flashcards: list[Flashcard]

__all__ = ['SummarySchema', 'PacingRecommendationsSchema', 'KeyTakeawaysSchema', 'ChaptersSchema', 'QuizQuestionsSchema', 'FlashcardsSchema']

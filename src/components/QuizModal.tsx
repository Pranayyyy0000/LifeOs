import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { storage } from '../services/storage';
import { QuizQuestion, QuizResponse, QuizResult } from '../types';

interface QuizModalProps {
  topic: string;
  taskTitle: string;
  onClose: () => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  topic,
  taskTitle,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchQuiz = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.generateQuiz(topic, taskTitle);
        if (isMounted) {
          setQuizData(res);
          setSelectedAnswers(new Array(res.questions.length).fill(-1));
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to generate quiz questions.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchQuiz();

    return () => {
      isMounted = false;
    };
  }, [topic, taskTitle]);

  const handleSelectOption = (optionIndex: number) => {
    if (isFinished) return;
    const nextAnswers = [...selectedAnswers];
    nextAnswers[currentIndex] = optionIndex;
    setSelectedAnswers(nextAnswers);
  };

  const handleNext = () => {
    if (!quizData) return;
    if (currentIndex < quizData.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const finishQuiz = () => {
    if (!quizData) return;

    let correctCount = 0;
    quizData.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswerIndex) {
        correctCount++;
      }
    });

    const total = quizData.questions.length;
    const percentage = Math.round((correctCount / total) * 100);
    const passed = percentage >= 70;

    const quizRes: QuizResult = {
      quizId: `quiz-${Date.now()}`,
      taskTitle,
      topic,
      score: correctCount,
      totalQuestions: total,
      percentage,
      passed,
      completedAt: new Date().toISOString(),
      recommendation: passed
        ? quizData.recommendationIfPassed
        : quizData.recommendationIfStruggled,
    };

    setResult(quizRes);
    setIsFinished(true);
    storage.saveQuizResult(quizRes);
  };

  const currentQ: QuizQuestion | undefined = quizData?.questions[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#16150F]/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-title"
    >
      <div className="bg-[#F3EFE7] max-w-xl w-full p-6 sm:p-8 border border-[#16150F]/20 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#16150F]/10">
          <div>
            <span className="text-xs font-mono-data uppercase tracking-wider text-[#D93A17]">
              Diagnostic Check
            </span>
            <h2 id="quiz-title" className="font-editorial text-2xl font-normal text-[#16150F] mt-1">
              Quiz: {topic}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#5E5A50] hover:text-[#16150F] py-1 px-2 border border-[#16150F]/20 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-12 text-center space-y-2">
            <div className="h-[2px] w-full bg-[#16150F]/10 overflow-hidden relative">
              <div className="h-full bg-[#16150F] w-1/3 animate-[pulse_1.5s_ease-in-out_infinite]" />
            </div>
            <p className="text-xs text-[#5E5A50] font-mono-data uppercase">
              Formulating diagnostic questions...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-[#EAE5DA] border-l-2 border-[#D93A17] text-xs space-y-2">
            <p className="font-medium text-[#16150F]">Unable to generate quiz right now.</p>
            <p className="text-[#5E5A50]">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 text-xs text-[#16150F] underline"
            >
              Return to task
            </button>
          </div>
        )}

        {/* Quiz in progress */}
        {quizData && !loading && !isFinished && currentQ && (
          <div className="space-y-6">
            {/* Progress counter */}
            <div className="flex items-center justify-between text-xs font-mono-data text-[#5E5A50]">
              <span>
                {currentIndex + 1} of {quizData.questions.length}
              </span>
              <span>{Math.round(((currentIndex + 1) / quizData.questions.length) * 100)}%</span>
            </div>

            {/* Question Text */}
            <h3 className="text-base sm:text-lg font-normal text-[#16150F] leading-snug">
              {currentQ.question}
            </h3>

            {/* Multiple Choice Options */}
            <div className="space-y-2">
              {currentQ.options.map((option, optIdx) => {
                const isSelected = selectedAnswers[currentIndex] === optIdx;
                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full text-left p-3.5 text-xs sm:text-sm border transition-colors cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-[#16150F] text-[#F3EFE7] border-[#16150F]'
                        : 'bg-[#EAE5DA]/60 hover:bg-[#EAE5DA] text-[#16150F] border-[#16150F]/15'
                    }`}
                  >
                    <span className="font-mono-data opacity-70">
                      {String.fromCharCode(65 + optIdx)}.
                    </span>
                    <span className="leading-relaxed">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Quiz Navigation */}
            <div className="pt-4 border-t border-[#16150F]/10 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="text-xs text-[#5E5A50] hover:text-[#16150F] disabled:opacity-30 disabled:pointer-events-none"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={selectedAnswers[currentIndex] === -1}
                className="px-5 py-2 text-xs font-medium bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] disabled:opacity-40 transition-colors"
              >
                {currentIndex === quizData.questions.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* Finished / Result Screen */}
        {isFinished && result && quizData && (
          <div className="space-y-6">
            <div className="p-6 bg-[#16150F] text-[#F3EFE7] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono-data uppercase tracking-wider text-[#A9A599]">
                <span>Quiz Score</span>
                <span>{result.passed ? 'Demonstrated grasp' : 'Needs review'}</span>
              </div>
              <div className="text-3xl sm:text-4xl font-editorial font-normal">
                {result.score} of {result.totalQuestions} ({result.percentage}%)
              </div>
              <p className="text-xs text-[#A9A599] leading-relaxed pt-2 border-t border-[#F3EFE7]/10">
                {result.recommendation}
              </p>
            </div>

            {/* Question Breakdown with Explanations */}
            <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
              <h4 className="text-xs font-mono-data uppercase text-[#5E5A50] tracking-wider">
                Detailed Review
              </h4>
              {quizData.questions.map((q, idx) => {
                const userAns = selectedAnswers[idx];
                const isCorrect = userAns === q.correctAnswerIndex;
                return (
                  <div
                    key={q.id}
                    className={`p-3 text-xs border ${
                      isCorrect
                        ? 'border-[#16150F]/20 bg-[#EAE5DA]/40'
                        : 'border-[#D93A17]/30 bg-[#EAE5DA]'
                    }`}
                  >
                    <div className="font-medium text-[#16150F] mb-1">
                      {idx + 1}. {q.question}
                    </div>
                    <div className="text-[#5E5A50]">
                      Your answer: {q.options[userAns]} {isCorrect ? '✓' : '✗'}
                    </div>
                    {!isCorrect && (
                      <div className="text-[#16150F] mt-0.5">
                        Correct answer: {q.options[q.correctAnswerIndex]}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-[#5E5A50] italic">
                      {q.explanation}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#16150F]/10 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-medium bg-[#16150F] text-[#F3EFE7] hover:bg-[#2A2821] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

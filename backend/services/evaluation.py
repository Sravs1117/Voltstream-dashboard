import os
import json
import time
import logging
from google.genai import types
from agents.gemini import gemini_service
from agents.rag import rag_service

logger = logging.getLogger(__name__)

# Predefined 10 QA test questions (aligned with evaluate_rag.py)
BENCHMARK_QUESTIONS = [
    "What is the most cost-effective efficiency upgrade to reduce heating and cooling energy loss?",
    "By how much can setting the thermostat to 18 degrees C during winter nights reduce annual heating costs?",
    "What are the main billing components of an electricity bill?",
    "When is the best time to run heavy loads to maximize self-consumption with solar offsets?",
    "What are the typical peak electricity demand hours during summer and winter months?",
    "How can you significantly reduce billing costs related to heavy appliance usage?",
    "How frequently do smart meters transmit usage data to the utility provider?",
    "How much of residential energy usage is typically accounted for by phantom or standby load?",
    "What is the recommended panel angle for peak annual performance of a residential solar array?",
    "How much does cleaning solar panels every 3 months increase overall output efficiency compared to uncleaned panels?"
]

EVALUATOR_PROMPT_TEMPLATE = """You are an expert RAG evaluator.

Question:
{question}

Retrieved Context:
{context}

Generated Answer:
{answer}

Evaluate:

Faithfulness (0-10):
- Is every claim supported by the context?
- Penalize hallucinations.

Relevance (0-10):
- Does the answer address the question?

Coverage (0-10):
- Does the answer cover the key information available in the context?

PASS if:
Faithfulness >= 7 and Relevance >= 7

Return ONLY valid JSON:
{{
  "faithfulness": 0,
  "relevance": 0,
  "coverage": 0,
  "status": "",
  "reason": "Single-line explanation with no raw newlines or unescaped quotes"
}}"""

class EvaluationService:
    def evaluate_single(self, question: str, context: str, answer: str) -> dict:
        """
        Runs the LLM-as-a-Judge evaluator on a single QA context triplet.
        """
        if not gemini_service.client:
            logger.error("Gemini client is not initialized.")
            return {
                "faithfulness": 0.0,
                "relevance": 0.0,
                "coverage": 0.0,
                "status": "FAIL",
                "reason": "Evaluation failed: LLM Judge client not available."
            }

        prompt = EVALUATOR_PROMPT_TEMPLATE.format(
            question=question,
            context=context or "No context retrieved.",
            answer=answer
        )

        # Retries for rate limiting robust execution
        for attempt in range(3):
            try:
                response = gemini_service.client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                )
                
                # Parse the JSON response
                raw_text = response.text.strip()
                logger.info(f"Evaluator raw response: {raw_text}")
                data = json.loads(raw_text)
                
                # Convert types to match desired schema
                faithfulness = float(data.get("faithfulness", 0.0))
                relevance = float(data.get("relevance", 0.0))
                coverage = float(data.get("coverage", 0.0))
                
                # Double-check pass criteria: Faithfulness >= 7 and Relevance >= 7
                status = "PASS" if faithfulness >= 7.0 and relevance >= 7.0 else "FAIL"
                
                return {
                    "faithfulness": faithfulness,
                    "relevance": relevance,
                    "coverage": coverage,
                    "status": status,
                    "reason": data.get("reason", "No reason provided.")
                }
            except Exception as e:
                raw_resp = response.text.strip() if 'response' in locals() and hasattr(response, 'text') else 'None'
                logger.warning(f"Evaluator attempt {attempt + 1} failed: {e}. Raw response: {raw_resp}")
                if attempt < 2:
                    time.sleep(2.0)
                else:
                    return {
                        "faithfulness": 0.0,
                        "relevance": 0.0,
                        "coverage": 0.0,
                        "status": "FAIL",
                        "reason": f"Evaluation exception: {str(e)[:150]}"
                    }

    def run_benchmark(self) -> list[dict]:
        """
        Runs the full 10-question benchmark:
        1. Queries RAG pipeline for each question.
        2. Sends question, context, answer to Evaluator.
        3. Returns the list of evaluation records.
        """
        results = []
        for idx, question in enumerate(BENCHMARK_QUESTIONS):
            logger.info(f"Running benchmark Q{idx+1}/10: '{question}'")
            
            # 1. Ask RAG Service
            rag_res = rag_service.ask(question)
            answer = rag_res.get("answer", "")
            context = rag_res.get("context", "")
            
            # 2. Run LLM Judge
            eval_res = self.evaluate_single(question, context, answer)
            
            # 3. Store result
            results.append({
                "question": question,
                "answer": answer,
                "context": context,
                "faithfulness": eval_res["faithfulness"],
                "relevance": eval_res["relevance"],
                "coverage": eval_res["coverage"],
                "status": eval_res["status"],
                "reason": eval_res["reason"]
            })
            
            # Sleep to avoid Gemini 429 rate limit
            time.sleep(1.5)
            
        return results

evaluation_service = EvaluationService()

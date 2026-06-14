import os
import sys
import json
import time
import warnings
import logging

# Globally ignore all python warnings
warnings.simplefilter("ignore")

# Silence noisy libraries
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
logging.getLogger("langchain").setLevel(logging.ERROR)

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Ensure backend directory is in path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv()

from agents.rag import rag_service
from agents.gemini import gemini_service
from google.genai import types

# Colors for nice CLI output
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# 10 Document-Grounded Q&A pairs from updated PDFs
QA_PAIRS = [
    {
        "question": "What is the most cost-effective efficiency upgrade to reduce heating and cooling energy loss?",
        "expected_answer": "Using caulk and weatherstripping around windows and doors, as up to 30% of energy is lost through small air leaks."
    },
    {
        "question": "By how much can setting the thermostat to 18 degrees C during winter nights reduce annual heating costs?",
        "expected_answer": "Setting the thermostat to 18 degrees C (64 degrees F) during winter nights can reduce annual heating costs by nearly 10%."
    },
    {
        "question": "What are the main billing components of an electricity bill?",
        "expected_answer": "Electricity bills consist of fixed connection charges, energy consumption charges (measured in kWh), and demand charges."
    },
    {
        "question": "When is the best time to run heavy loads to maximize self-consumption with solar offsets?",
        "expected_answer": "The best time to run heavy loads is when solar generation is highest, typically between 11 AM and 2 PM."
    },
    {
        "question": "What are the typical peak electricity demand hours during summer and winter months?",
        "expected_answer": "Peak electricity demand typically occurs between 7 PM and 9 PM during summer and winter months."
    },
    {
        "question": "How can you significantly reduce billing costs related to heavy appliance usage?",
        "expected_answer": "By shifting heavy appliance usage to off-peak hours (after 10 PM or before 6 AM)."
    },
    {
        "question": "How frequently do smart meters transmit usage data to the utility provider?",
        "expected_answer": "Smart meters transmit usage data every 15 minutes."
    },
    {
        "question": "How much of residential energy usage is typically accounted for by phantom or standby load?",
        "expected_answer": "Phantom or standby load accounts for up to 10% of residential energy usage."
    },
    {
        "question": "What is the recommended panel angle for peak annual performance of a residential solar array?",
        "expected_answer": "The recommended panel angle should be equal to the local latitude, generally between 30 degrees and 45 degrees."
    },
    {
        "question": "How much does cleaning solar panels every 3 months increase overall output efficiency compared to uncleaned panels?",
        "expected_answer": "Cleaning solar panels every 3 months increases overall output efficiency by 15%."
    }
]
JUDGE_PROMPT_TEMPLATE = """You are an expert AI judge evaluating a Retrieval-Augmented Generation (RAG) system.
Your job is to rate a generated answer based on the retrieved context documents and the user's question.

You must rate three metrics:
1. **Faithfulness**: Is the generated answer fully grounded in the retrieved context? It should not contain any facts, figures, or claims that are not present in or directly inferable from the retrieved context. (Rate 1 to 5, where 5 means perfectly faithful and 1 means completely hallucinated/unsupported).
2. **Relevance**: Does the generated answer directly and correctly address the user's question? (Rate 1 to 5, where 5 means perfectly relevant and directly answers the question, and 1 means completely off-topic or fails to answer the question).
3. **Completeness**: Does the generated answer cover all key information available in the retrieved context that is relevant to the question? It should not omit important details or caveats mentioned in the context that help answer the question. (Rate 1 to 5, where 5 means fully complete and covers all key details from the context, and 1 means extremely incomplete, omitting crucial details).

Inputs:
- User Question: {question}
- Retrieved Context: {context}
- Generated Answer: {answer}

Provide your evaluation as a JSON object with the following schema:
{{
  "faithfulness_score": <int 1-5>,
  "faithfulness_reason": "<string explanation>",
  "relevance_score": <int 1-5>,
  "relevance_reason": "<string explanation>",
  "completeness_score": <int 1-5>,
  "completeness_reason": "<string explanation>"
}}
Return ONLY the raw JSON object. Do not wrap it in markdown code blocks or add any other text.
"""

def evaluate_answer(question, context, answer):
    """
    Evaluates the generated answer using Gemini 2.5 Flash as judge.
    Returns scores and reasons, retrying on 429 rate limit errors.
    """
    if not gemini_service.client:
        raise RuntimeError("Gemini client is not initialized.")

    prompt = JUDGE_PROMPT_TEMPLATE.format(
        question=question,
        context=context,
        answer=answer
    )

    max_retries = 5
    backoff = 3.0
    for attempt in range(max_retries):
        try:
            response = gemini_service.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
            
            text = response.text.strip()
            # Clean any accidental markdown codeblock wrapper if it's there
            if text.startswith("```"):
                lines = text.split("\n")
                if lines[0].startswith("```json") or lines[0].startswith("```"):
                    text = "\n".join(lines[1:-1]).strip()
                    
            eval_data = json.loads(text)
            return eval_data
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
                print(f"    [Judge Warning] Rate limited (429). Retrying in {backoff}s... (Attempt {attempt+1}/{max_retries})")
                time.sleep(backoff)
                backoff *= 2.0
            else:
                print(f"Error calling judge: {e}")
                return {
                    "faithfulness_score": 1,
                    "faithfulness_reason": f"Evaluation error: {str(e)}",
                    "relevance_score": 1,
                    "relevance_reason": f"Evaluation error: {str(e)}",
                    "completeness_score": 1,
                    "completeness_reason": f"Evaluation error: {str(e)}"
                }

    return {
        "faithfulness_score": 1,
        "faithfulness_reason": "Evaluation failed: rate limit exceeded after maximum retries.",
        "relevance_score": 1,
        "relevance_reason": "Evaluation failed: rate limit exceeded after maximum retries.",
        "completeness_score": 1,
        "completeness_reason": "Evaluation failed: rate limit exceeded after maximum retries."
    }



def generate_pdf_report(results, passed_count, total_count, pass_rate, filename):
    try:
        from fpdf import FPDF
    except ImportError:
        print(f"\n{YELLOW}⚠️  [PDF Warning] The 'fpdf2' library is not installed in this Python environment.{RESET}")
        print(f"   To auto-generate the PDF report, please run: {BOLD}pip install fpdf2{RESET}")
        return
    
    class PDFReport(FPDF):
        def header(self):
            self.set_font("helvetica", "B", 16)
            self.set_text_color(2, 132, 199) # Blue theme matching VoltStream UI
            self.cell(0, 10, "VoltStream RAG Quality Evaluation Report", ln=True, align="L")
            self.set_font("helvetica", "", 10)
            self.set_text_color(100, 116, 139)
            self.cell(0, 5, f"Generated on: {time.strftime('%Y-%m-%d %H:%M:%S')} | Predefined QA Suite", ln=True, align="L")
            self.ln(5)
            self.line(10, self.get_y(), 200, self.get_y())
            self.ln(5)
            
        def footer(self):
            self.set_y(-15)
            self.set_font("helvetica", "I", 8)
            self.set_text_color(150, 150, 150)
            self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    pdf = PDFReport()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Summary Metrics Card
    pdf.set_fill_color(248, 250, 252) # Slate 50
    pdf.set_draw_color(226, 232, 240) # Slate 200
    pdf.rect(10, pdf.get_y(), 190, 32, "FD")
    
    pdf.set_y(pdf.get_y() + 4)
    pdf.set_x(15)
    pdf.set_font("helvetica", "B", 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "Summary Metrics:", ln=True)
    
    pdf.set_font("helvetica", "", 10)
    pdf.set_x(15)
    pdf.cell(50, 6, f"Total Questions: {total_count}")
    pdf.cell(50, 6, f"Passed: {passed_count}")
    pdf.cell(50, 6, f"Failed: {total_count - passed_count}")
    pdf.ln(6)
    
    pdf.set_x(15)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(50, 6, f"Pass Rate: {pass_rate:.1f}%")
    
    pdf.ln(16)
    
    # Questions List
    for r in results:
        # Check space left on page, add page if needed
        if pdf.get_y() > 240:
            pdf.add_page()
            
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(15, 23, 42)
        
        # Render question (wrapped text)
        pdf.set_x(10)
        pdf.multi_cell(190, 5, f"Question {r['idx']}: {r['question']}")
        
        # Render answer snippet (wrapped text)
        pdf.set_font("helvetica", "I", 9)
        pdf.set_text_color(71, 85, 105)
        pdf.set_x(10)
        pdf.multi_cell(190, 5, f"Answer: {r['answer']}")
        
        # Scores line
        pdf.set_font("helvetica", "", 9)
        pdf.set_text_color(100, 116, 139)
        scores_str = f"Scores -> Faithfulness: {r['faithfulness_score']}/5 | Relevance: {r['relevance_score']}/5 | Completeness: {r['completeness_score']}/5"
        pdf.set_x(10)
        pdf.cell(140, 6, scores_str)
        
        # Status block
        if r['status'] == "PASS":
            pdf.set_font("helvetica", "B", 9)
            pdf.set_text_color(16, 185, 129) # green
            pdf.cell(50, 6, "Status: PASS", align="R")
        else:
            pdf.set_font("helvetica", "B", 9)
            pdf.set_text_color(239, 68, 68) # red
            pdf.cell(50, 6, "Status: FAIL", align="R")
            
        pdf.ln(8)
        pdf.set_draw_color(241, 245, 249)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(4)
        
    try:
        pdf.output(filename)
        print(f"\nEvaluation report PDF generated at: {filename}")
    except Exception as e:
        print(f"\nFailed to generate PDF report: {e}")

def main():
    print(f"\n{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}  VoltStream RAG pipeline evaluation framework{RESET}")
    print(f"{BOLD}{CYAN}  LLM-as-Judge using Gemini 2.5 Flash{RESET}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")

    # Initialize RAG Service
    print("\nInitializing RAG Service...")
    rag_service.initialize()
    if not rag_service._initialized:
        print(f"{RED}Error: RAG Service initialization failed.{RESET}")
        sys.exit(1)
    print(f"{GREEN}RAG Service initialized successfully.{RESET}\n")

    results = []
    passed_count = 0

    for idx, qa in enumerate(QA_PAIRS, 1):
        question = qa["question"]
        expected_answer = qa["expected_answer"]
        print(f"{BOLD}Question {idx}/10: {question}{RESET}")
        print(f"  {CYAN}Expected Answer: {expected_answer}{RESET}")
        
        # Run through RAG with retries if quota exceeded
        answer = ""
        sources = []
        context = ""
        max_rag_retries = 3
        rag_backoff = 4.0
        
        for attempt in range(max_rag_retries):
            t0 = time.time()
            rag_result = rag_service.ask(question)
            duration = time.time() - t0
            
            answer = rag_result.get("answer", "")
            sources = rag_result.get("sources", [])
            context = rag_result.get("context", "")
            
            # Check if answer contains quota warning
            if "quota exceeded" in answer.lower():
                print(f"  [RAG Warning] Rate limited (429) during ask. Retrying in {rag_backoff}s... (Attempt {attempt+1}/{max_rag_retries})")
                time.sleep(rag_backoff)
                rag_backoff *= 2.0
            else:
                break

        print(f"  {YELLOW}Answer generated in {duration:.2f}s:{RESET}")
        print(f"  {CYAN}{answer}{RESET}")
        print(f"  {YELLOW}Sources:{RESET} {sources}")
        
        # Pacing sleep to prevent hitting Gemini API rate limits
        time.sleep(8)

        # Evaluate via LLM-as-judge
        print(f"  Running LLM-as-Judge evaluation...")
        eval_res = evaluate_answer(question, context, answer)
        
        f_score = eval_res.get("faithfulness_score", 1)
        f_reason = eval_res.get("faithfulness_reason", "N/A")
        r_score = eval_res.get("relevance_score", 1)
        r_reason = eval_res.get("relevance_reason", "N/A")
        c_score = eval_res.get("completeness_score", 1)
        c_reason = eval_res.get("completeness_reason", "N/A")
        
        # Check pass condition: Faithfulness >= 4 AND Relevance >= 4 AND Completeness >= 4
        is_pass = (f_score >= 4) and (r_score >= 4) and (c_score >= 4)
        status_str = f"{GREEN}PASS{RESET}" if is_pass else f"{RED}FAIL{RESET}"
        
        if is_pass:
            passed_count += 1
            
        print(f"  {BOLD}Evaluation Scores:{RESET}")
        print(f"    - Faithfulness: {BOLD}{f_score}/5{RESET} (Reason: {f_reason})")
        print(f"    - Relevance:    {BOLD}{r_score}/5{RESET} (Reason: {r_reason})")
        print(f"    - Completeness: {BOLD}{c_score}/5{RESET} (Reason: {c_reason})")
        print(f"    - Status:       {BOLD}{status_str}{RESET}\n")
        
        results.append({
            "idx": idx,
            "question": question,
            "answer": answer,
            "faithfulness_score": f_score,
            "relevance_score": r_score,
            "completeness_score": c_score,
            "status": "PASS" if is_pass else "FAIL"
        })

        # Pacing sleep to prevent hitting Gemini API rate limits
        time.sleep(10)

    # Summary Report
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}  FINAL EVALUATION REPORT{RESET}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")
    print(f"  {'Q#':<4} | {'Question':<45} | {'Faith':<5} | {'Rel':<5} | {'Compl':<5} | {'Status':<6}")
    print(f"  {'-'*70}")
    for r in results:
        q_truncated = r["question"][:42] + "..." if len(r["question"]) > 45 else r["question"]
        status_color = GREEN if r["status"] == "PASS" else RED
        print(f"  {r['idx']:<4} | {q_truncated:<45} | {r['faithfulness_score']:<5} | {r['relevance_score']:<5} | {r['completeness_score']:<5} | {status_color}{r['status']}{RESET}")
    print(f"  {'-'*70}")
    
    total = len(QA_PAIRS)
    failed_count = total - passed_count
    pass_rate = (passed_count / total) * 100
    
    print(f"  Total Questions : {total}")
    print(f"  Passed          : {GREEN}{passed_count}{RESET}")
    print(f"  Failed          : {RED if failed_count > 0 else GREEN}{failed_count}{RESET}")
    print(f"  Pass Rate       : {BOLD}{pass_rate:.1f}%{RESET}")
    print(f"{BOLD}{CYAN}{'='*70}{RESET}")

    # Generate PDF Report in the backend
    pdf_report_path = os.path.join(BACKEND_DIR, "evaluation_report.pdf")
    generate_pdf_report(results, passed_count, total, pass_rate, pdf_report_path)

    # Check target of at least 7/10 passed
    if passed_count >= 7:
        print(f"\n{GREEN}{BOLD}🎉 SUCCESS: The RAG pipeline passed the evaluation checkpoint! ({passed_count}/{total} passed, target is >= 7){RESET}\n")
        sys.exit(0)
    else:
        print(f"\n{RED}{BOLD}❌ FAILURE: The RAG pipeline failed to meet the evaluation target of at least 7/10 passing. ({passed_count}/{total} passed){RESET}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()

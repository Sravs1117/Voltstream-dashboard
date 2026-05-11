from fastapi import APIRouter
from schemas.billing import BillingSummary

router = APIRouter()

@router.get("/summary", response_model=BillingSummary)
def get_billing_summary():
    """Current balance, projected bill, and budget limit."""
    return BillingSummary(
        current_balance=247.60,
        projected_bill=318.90,
        budget_limit=280.00,
    )

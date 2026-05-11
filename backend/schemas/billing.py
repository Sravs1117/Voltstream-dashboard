from pydantic import BaseModel

class BillingSummary(BaseModel):
    current_balance: float
    projected_bill: float
    budget_limit: float

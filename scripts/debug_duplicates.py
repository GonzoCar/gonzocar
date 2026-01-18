
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import SessionLocal

def inspect_db():
    db = SessionLocal()
    try:
        print("🔍 Inspecting payments_raw duplicates...")
        
        # Check Shanequa's payments
        query = text("SELECT id, source, sender_name, amount, transaction_id, gmail_id, created_at, memo FROM payments_raw WHERE sender_name LIKE '%Shanequa%' ORDER BY created_at DESC LIMIT 20")
        results = db.execute(query).fetchall()
        
        for row in results:
            print(f"ID: {row.id} | Src: {row.source} | Amt: {row.amount} | TxID: {row.transaction_id} | GmailID: {row.gmail_id} | Memo: {row.memo}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_db()
